"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clients, contractTemplates, inquiries, invoices, payments, photographers } from "@/db/schema";
import {
  MAX_INSTALLMENTS,
  buildSchedule,
  finalDueDate,
  invoiceTotals,
  parseTaxRate,
  type LineItem,
  type PaymentPlan,
} from "@/lib/invoices/math";
import { emailInvoice } from "@/lib/invoices/notify";
import { createWithNumber, invoicesAllowed, refreshPaid, studioToday } from "@/lib/invoices/server";
import { requirePhotographer } from "@/lib/session";

// The studio's quote and invoice tools. Each checks who is logged in and
// that the invoice is theirs; making and sending them needs Pro or Studio.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = (text: string) => {
  const value = text.trim().replace(/[$,]/g, "");
  return /^-?\d{1,7}(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : null;
};

const editorSchema = z.object({
  id: z.uuid().nullable(),
  kind: z.enum(["quote", "invoice"]),
  clientId: z.uuid().nullable(),
  inquiryId: z.uuid().nullable(),
  clientName: z.string().trim().min(1, "Add the client's name.").max(120),
  clientEmail: z.email("Add the client's email so they can get it.").max(200),
  clientPhone: z.string().trim().max(40),
  title: z.string().trim().min(1, "Give it a title, like “Wedding photography”.").max(150),
  eventDate: z.union([z.literal(""), day]),
  items: z
    .array(z.object({ description: z.string().trim().max(300), quantity: z.string(), price: z.string() }))
    .max(100),
  taxRate: z.string().max(10),
  plan: z.object({
    mode: z.enum(["full", "deposit", "installments"]),
    depositPercent: z.number().int().min(0).max(100),
    count: z.number().int().min(1).max(MAX_INSTALLMENTS),
    every: z.enum(["month", "2weeks", "week"]),
    firstDue: z.union([z.literal(""), day]),
  }),
  dueDate: z.union([z.literal(""), day]),
  contractTemplateId: z.uuid().nullable(),
  notes: z.string().max(4000),
  terms: z.string().max(8000),
});
export type EditorInput = z.input<typeof editorSchema>;

async function owned(id: string, photographerId: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.photographerId, photographerId)));
  return invoice ?? null;
}

// Edits stop once money has come in, a contract is signed, or a quote is answered.
const editable = (i: { status: string; paidCents: number; signedAt: Date | null }) =>
  (i.status === "draft" || i.status === "sent") && i.paidCents === 0 && !i.signedAt;

// Saves the editor; "send" also emails it to the client.
export async function saveInvoice(input: EditorInput, send: boolean): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  if (!(await invoicesAllowed(user.id))) return { message: "Quotes and invoices are on the Pro and Studio plans." };
  const parsed = editorSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const f = parsed.data;

  const items: LineItem[] = [];
  for (const [n, row] of f.items.entries()) {
    if (!row.description && !row.price.trim()) continue;
    const quantity = Number(row.quantity.trim() || "1");
    const unitCents = money(row.price || "0");
    if (!row.description) return { message: `Line ${n + 1} needs a description.` };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !/^\d+(\.\d{1,2})?$/.test(row.quantity.trim() || "1")) {
      return { message: `Line ${n + 1}: enter a quantity like 1 or 2.5.` };
    }
    if (unitCents === null) return { message: `Line ${n + 1}: enter a price like 250 or 49.99.` };
    items.push({ description: row.description, quantity, unitCents });
  }
  if (!items.length) return { message: "Add at least one line item." };
  const taxBps = parseTaxRate(f.taxRate);
  if (taxBps === null) return { message: "Enter the tax rate as a percent, like 7.25." };
  const totals = invoiceTotals(items, taxBps);
  if (totals.totalCents <= 0) return { message: "The total has to be more than $0." };
  if (totals.totalCents > 99_999_999) return { message: "That total is too large." };

  let plan: PaymentPlan;
  if (f.plan.mode === "installments") {
    if (!f.plan.firstDue) return { message: "Pick the date of the first installment." };
    if (f.plan.count < 2 && f.plan.depositPercent === 0) return { message: "A payment plan needs at least 2 payments." };
    plan = { mode: "installments", depositPercent: f.plan.depositPercent, count: f.plan.count, every: f.plan.every, firstDue: f.plan.firstDue };
  } else if (f.plan.mode === "deposit") {
    plan = { mode: "deposit", depositPercent: f.plan.depositPercent };
  } else plan = { mode: "full" };
  const schedule = buildSchedule(totals.totalCents, plan, f.dueDate || null);

  // Only this studio's own clients, inquiries, and contracts.
  let clientId = f.clientId;
  if (clientId) {
    const [c] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.photographerId, user.id)));
    if (!c) clientId = null;
  }
  if (!clientId) {
    // Match an existing client by email, or add them to Clients.
    const [match] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.photographerId, user.id), sql`lower(${clients.email}) = ${f.clientEmail.toLowerCase()}`))
      .limit(1);
    clientId =
      match?.id ??
      (
        await db
          .insert(clients)
          .values({ photographerId: user.id, name: f.clientName, email: f.clientEmail, phone: f.clientPhone || null })
          .returning({ id: clients.id })
      )[0].id;
  }
  let contractTemplateId = f.contractTemplateId;
  if (contractTemplateId) {
    const [t] = await db
      .select({ id: contractTemplates.id })
      .from(contractTemplates)
      .where(and(eq(contractTemplates.id, contractTemplateId), eq(contractTemplates.photographerId, user.id)));
    if (!t) contractTemplateId = null;
  }
  let inquiryId = f.inquiryId;
  if (inquiryId) {
    const [q] = await db.select({ id: inquiries.id }).from(inquiries).where(and(eq(inquiries.id, inquiryId), eq(inquiries.photographerId, user.id)));
    if (!q) inquiryId = null;
  }

  const values = {
    clientId,
    clientName: f.clientName,
    clientEmail: f.clientEmail,
    clientPhone: f.clientPhone || null,
    title: f.title,
    eventDate: f.eventDate || null,
    items,
    taxBps,
    ...totals,
    plan,
    schedule,
    dueDate: finalDueDate(schedule),
    contractTemplateId,
    notes: f.notes.trim() || null,
    terms: f.terms.trim() || null,
    updatedAt: new Date(),
  };

  let id: string;
  if (f.id) {
    const current = await owned(f.id, user.id);
    if (!current) return { message: "That quote or invoice could not be found." };
    if (!editable(current)) return { message: "This can't be changed anymore: it's been answered, signed, or paid." };
    await db.update(invoices).set(values).where(eq(invoices.id, current.id));
    id = current.id;
  } else {
    const [studio] = await db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, user.id));
    const row = await createWithNumber({ ...values, photographerId: user.id, kind: f.kind, inquiryId }, studio.timeZone);
    id = row.id;
    if (inquiryId) {
      await db.update(inquiries).set({ clientId, status: "converted" }).where(and(eq(inquiries.id, inquiryId), eq(inquiries.status, "new")));
    }
  }

  // It's saved either way; the page says whether the email went out.
  const emailed = send ? !(await sendInvoice(id, null)).message : false;
  revalidatePath("/dashboard/invoices");
  redirect(`/dashboard/invoices/${id}${send ? `?sent=${emailed ? 1 : 0}` : ""}`);
}

// Emails it to the client (again, if it was already sent).
export async function sendInvoice(id: string, message: string | null): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  if (!(await invoicesAllowed(user.id))) return { message: "Quotes and invoices are on the Pro and Studio plans." };
  const invoice = await owned(id, user.id);
  if (!invoice) return { message: "That quote or invoice could not be found." };
  if (invoice.status === "cancelled" || invoice.status === "declined") return { message: "It's cancelled or declined, so it can't be sent." };
  if (invoice.status === "draft") {
    await db.update(invoices).set({ status: "sent", sentAt: new Date(), updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
  }
  const note = message?.trim().slice(0, 2000) || null;
  const sent = await emailInvoice(invoice.id, note);
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  revalidatePath("/dashboard/invoices");
  return sent ? {} : { message: "It's ready, but the email didn't go out. Check the Email log, or copy the link and send it yourself." };
}

// The client said yes some other way (phone, in person).
export async function markApproved(id: string): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  const invoice = await owned(id, user.id);
  if (!invoice || invoice.kind !== "quote" || invoice.status !== "sent") return { message: "Only a quote waiting for an answer can be approved." };
  await db.update(invoices).set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
  await refreshPaid(invoice.id);
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  return {};
}

export async function cancelInvoice(id: string): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  const invoice = await owned(id, user.id);
  if (!invoice) return { message: "That quote or invoice could not be found." };
  if (invoice.status === "paid") return { message: "It's paid in full, so it can't be cancelled." };
  await db.update(invoices).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  revalidatePath("/dashboard/invoices");
  return {};
}

// Deleting is for drafts and cancelled ones nobody has paid online; anything
// with a payment stays for the records.
export async function deleteInvoice(id: string): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  const invoice = await owned(id, user.id);
  if (!invoice) return { message: "That quote or invoice could not be found." };
  if (invoice.status !== "draft" && invoice.status !== "cancelled") return { message: "Cancel it first, then you can delete it." };
  const [paid] = await db.select({ id: payments.id }).from(payments).where(and(eq(payments.invoiceId, invoice.id), eq(payments.status, "paid"))).limit(1);
  if (paid || invoice.manualPayments.length) return { message: "It has payments on it, so it's kept for your records." };
  await db.delete(invoices).where(eq(invoices.id, invoice.id));
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

// A copy as a new draft (same client, items, and plan), e.g. for a repeat client.
export async function duplicateInvoice(id: string, kind: "quote" | "invoice"): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  if (!(await invoicesAllowed(user.id))) return { message: "Quotes and invoices are on the Pro and Studio plans." };
  const invoice = await owned(id, user.id);
  if (!invoice) return { message: "That quote or invoice could not be found." };
  const [studio] = await db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, user.id));
  const today = studioToday(studio.timeZone);
  // Dates in the past don't carry over.
  const plan: PaymentPlan = invoice.plan.mode === "installments" && invoice.plan.firstDue < today ? { ...invoice.plan, firstDue: today } : invoice.plan;
  const dueDate = invoice.dueDate && invoice.dueDate >= today ? invoice.dueDate : null;
  const schedule = buildSchedule(invoice.totalCents, plan, plan.mode === "installments" ? null : dueDate);
  const row = await createWithNumber(
    {
      photographerId: user.id,
      clientId: invoice.clientId,
      kind,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      title: invoice.title,
      eventDate: invoice.eventDate && invoice.eventDate >= today ? invoice.eventDate : null,
      items: invoice.items,
      taxBps: invoice.taxBps,
      subtotalCents: invoice.subtotalCents,
      taxCents: invoice.taxCents,
      totalCents: invoice.totalCents,
      plan,
      schedule,
      dueDate: finalDueDate(schedule),
      contractTemplateId: invoice.contractTemplateId,
      notes: invoice.notes,
      terms: invoice.terms,
    },
    studio.timeZone,
  );
  revalidatePath("/dashboard/invoices");
  redirect(`/dashboard/invoices/${row.id}/edit`);
}

// A payment the client made another way (cash, check, Venmo, Zelle).
export async function recordPayment(id: string, input: { amount: string; note: string; date: string }): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  const invoice = await owned(id, user.id);
  if (!invoice) return { message: "That quote or invoice could not be found." };
  if (invoice.status === "draft" || invoice.status === "cancelled" || invoice.status === "declined") {
    return { message: "Send it (or reopen it) before recording a payment." };
  }
  const cents = money(input.amount);
  if (!cents || cents <= 0) return { message: "Enter the amount paid, like 250." };
  if (cents > invoice.totalCents - invoice.paidCents) return { message: "That's more than the balance." };
  if (!day.safeParse(input.date).success) return { message: "Pick the date it was paid." };
  const note = input.note.trim().slice(0, 100) || "Paid offline";
  await db
    .update(invoices)
    .set({
      manualPayments: [...invoice.manualPayments, { amountCents: cents, note, date: input.date }],
      // Recording a payment on a quote means the client said yes.
      ...(invoice.kind === "quote" && invoice.status === "sent" ? { status: "approved" as const, approvedAt: new Date() } : {}),
    })
    .where(eq(invoices.id, invoice.id));
  await refreshPaid(invoice.id);
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  revalidatePath("/dashboard/invoices");
  return {};
}

export async function removeRecordedPayment(id: string, index: number): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  const invoice = await owned(id, user.id);
  if (!invoice || !invoice.manualPayments[index]) return { message: "That payment could not be found." };
  await db
    .update(invoices)
    .set({ manualPayments: invoice.manualPayments.filter((_, i) => i !== index) })
    .where(eq(invoices.id, invoice.id));
  await refreshPaid(invoice.id);
  revalidatePath(`/dashboard/invoices/${invoice.id}`);
  return {};
}

// What new quotes and invoices start with.
export async function saveInvoiceDefaults(input: { taxRate: string; depositPercent: string; terms: string }): Promise<{ message?: string; saved?: boolean }> {
  const user = await requirePhotographer();
  const taxBps = parseTaxRate(input.taxRate);
  if (taxBps === null) return { message: "Enter the tax rate as a percent, like 7.25." };
  const deposit = Number(input.depositPercent.trim().replace(/%$/, "") || "0");
  if (!Number.isInteger(deposit) || deposit < 0 || deposit > 100) return { message: "The deposit is a whole percent from 0 to 100." };
  await db
    .update(photographers)
    .set({ invoiceTaxBps: taxBps, invoiceDepositPercent: deposit, invoiceTerms: input.terms.trim().slice(0, 8000) || null })
    .where(eq(photographers.id, user.id));
  revalidatePath("/dashboard/invoices");
  return { saved: true };
}
