import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import * as messages from "@/lib/email/invoice-messages";
import { sendToClient, sendToStudio, studioSender } from "@/lib/email/send";
import { formatDay, nextScheduled } from "./math";
import { invoiceDashboardUrl, invoiceUrl, needsSignature, type Invoice } from "./server";

// The quote and invoice emails. Each loads the invoice fresh, so callers
// just say what happened (usually through afterResponse()).

function facts(invoice: Invoice, studioName: string): messages.InvoiceFacts {
  return {
    studioName,
    kind: invoice.kind,
    number: invoice.number,
    title: invoice.title,
    clientName: invoice.clientName,
    totalCents: invoice.totalCents,
    paidCents: invoice.paidCents,
    eventDate: invoice.eventDate ? formatDay(invoice.eventDate) : null,
    url: invoiceUrl(invoice.token),
    needsSignature: needsSignature(invoice),
  };
}

async function load(invoiceId: string) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  return invoice ?? null;
}

async function studioName(photographerId: string) {
  return (await studioSender(photographerId))?.studioName ?? "Your photographer";
}

export async function emailInvoice(invoiceId: string, message: string | null) {
  const invoice = await load(invoiceId);
  if (!invoice) return false;
  const next = nextScheduled(invoice.schedule, invoice.paidCents);
  return sendToClient(
    invoice.photographerId,
    "invoice_sent",
    invoice.clientEmail,
    messages.invoiceSentClient(facts(invoice, await studioName(invoice.photographerId)), {
      message,
      next: next ? { label: next.label, amountCents: next.amountCents, due: next.dueDate ? formatDay(next.dueDate) : null } : null,
    }),
  );
}

export async function emailQuoteReminder(invoiceId: string) {
  const invoice = await load(invoiceId);
  if (!invoice || invoice.status !== "sent" || invoice.kind !== "quote") return false;
  return sendToClient(
    invoice.photographerId,
    "quote_reminder",
    invoice.clientEmail,
    messages.quoteReminderClient(facts(invoice, await studioName(invoice.photographerId))),
  );
}

// Upcoming (or past due) scheduled payment. False when nothing is owed now.
export async function emailPaymentDue(invoiceId: string, overdue: boolean) {
  const invoice = await load(invoiceId);
  if (!invoice) return false;
  const next = nextScheduled(invoice.schedule, invoice.paidCents);
  if (!next?.dueDate) return false;
  const f = facts(invoice, await studioName(invoice.photographerId));
  const p = { label: next.label, amountCents: next.amountCents, due: formatDay(next.dueDate) };
  return sendToClient(
    invoice.photographerId,
    overdue ? "invoice_overdue" : "invoice_reminder",
    invoice.clientEmail,
    overdue ? messages.paymentOverdueClient(f, p) : messages.paymentReminderClient(f, p),
  );
}

// An online payment: the client's receipt and a notice to the studio.
export async function emailInvoicePaid(invoiceId: string, amountCents: number) {
  const invoice = await load(invoiceId);
  if (!invoice) return;
  const f = facts(invoice, await studioName(invoice.photographerId));
  await sendToClient(invoice.photographerId, "invoice_payment", invoice.clientEmail, messages.invoicePaymentClient(f, amountCents));
  await sendToStudio(
    invoice.photographerId,
    "invoice_update",
    messages.invoiceUpdateStudio({ ...f, dashboardUrl: invoiceDashboardUrl(invoice.id) }, { type: "paid", amountCents }),
    { replyTo: invoice.clientEmail },
  );
}

export async function emailInvoiceUpdate(
  invoiceId: string,
  what: { type: "approved" } | { type: "declined"; reason: string | null } | { type: "signed"; signerName: string },
) {
  const invoice = await load(invoiceId);
  if (!invoice) return;
  const f = facts(invoice, await studioName(invoice.photographerId));
  await sendToStudio(invoice.photographerId, "invoice_update", messages.invoiceUpdateStudio({ ...f, dashboardUrl: invoiceDashboardUrl(invoice.id) }, what), {
    replyTo: invoice.clientEmail,
  });
}
