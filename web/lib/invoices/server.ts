import { randomBytes } from "node:crypto";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { contractTemplates, invoices, payments, photographers } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { formatDate, localDateOf } from "@/lib/booking/time";
import { fillPlaceholders } from "@/lib/contracts/placeholders";
import { effectivePlan, hasFeature } from "@/lib/plans";
import { sanitizeRichText } from "@/lib/rich-text";
import { siteUrl } from "@/lib/site";
import {
  balanceCents,
  canPay,
  formatDay,
  invoiceNumber,
  nextScheduled,
  sequenceOf,
  statusAfterPayment,
  type InvoiceKind,
} from "./math";

// Database side of quotes and invoices: numbering, the client's private
// link, the contract, and what's been paid. The math is in ./math.ts.

export type Invoice = typeof invoices.$inferSelect;

export const newInvoiceToken = () => randomBytes(24).toString("base64url");
export const invoiceUrl = (token: string) => `${siteUrl}/i/${token}`;
export const invoiceDashboardUrl = (id: string) => `${siteUrl}/dashboard/invoices/${id}`;

// Whether a studio's plan includes quotes and invoices (Pro during the trial).
export async function invoicesAllowed(photographerId: string) {
  const [studio] = await db
    .select({ plan: photographers.plan, trialEndsAt: photographers.trialEndsAt })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  return Boolean(studio) && hasFeature(effectivePlan(studio.plan, studio.trialEndsAt), "invoices");
}

// The next number in this year's series, e.g. INV-2026-0008. Two made at the
// same moment could pick the same one; the unique rule catches that and the
// caller tries again (see createWithNumber).
export async function nextNumber(photographerId: string, kind: InvoiceKind, year: number) {
  const prefix = `${kind === "quote" ? "Q" : "INV"}-${year}-`;
  const rows = await db
    .select({ number: invoices.number })
    .from(invoices)
    .where(and(eq(invoices.photographerId, photographerId), like(invoices.number, `${prefix}%`)));
  const highest = rows.reduce((max, r) => Math.max(max, sequenceOf(r.number, kind, year)), 0);
  return invoiceNumber(kind, year, highest + 1);
}

// Inserts a new quote or invoice with the next free number.
export async function createWithNumber(values: Omit<typeof invoices.$inferInsert, "number" | "token">, timeZone: string) {
  const year = Number(localDateOf(new Date(), timeZone).slice(0, 4));
  for (let attempt = 0; ; attempt++) {
    const number = await nextNumber(values.photographerId, values.kind, year);
    try {
      const [row] = await db
        .insert(invoices)
        .values({ ...values, number, token: newInvoiceToken() })
        .returning();
      return row;
    } catch (error) {
      if (attempt >= 4) throw error;
    }
  }
}

// A quote or invoice by the client's private link, with the studio details its page needs.
export async function findClientInvoice(token: string) {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .select({
      invoice: invoices,
      studioName: photographers.name,
      businessName: photographers.businessName,
      studioEmail: photographers.email,
      slug: photographers.studioSlug,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
      timeZone: photographers.timeZone,
      stripeReady: photographers.stripeChargesEnabled,
      stripeAccountId: photographers.stripeAccountId,
    })
    .from(invoices)
    .innerJoin(photographers, eq(photographers.id, invoices.photographerId))
    .where(eq(invoices.token, token));
  if (!row || row.invoice.status === "draft") return null;
  return { ...row, name: row.businessName || row.studioName };
}

export function studioToday(timeZone: string) {
  return localDateOf(new Date(), timeZone);
}

// A contract still to be signed before the client can pay.
export const needsSignature = (invoice: Pick<Invoice, "contractTemplateId" | "contractContent" | "signedAt">) =>
  !invoice.signedAt && Boolean(invoice.contractTemplateId);

// The contract template with this invoice's details filled in, ready to sign.
// The same {{TAGS}} as booking contracts: the title is the "session".
export async function filledInvoiceContract(invoice: Invoice) {
  if (!invoice.contractTemplateId) return null;
  const [template] = await db
    .select()
    .from(contractTemplates)
    .where(and(eq(contractTemplates.id, invoice.contractTemplateId), eq(contractTemplates.photographerId, invoice.photographerId)));
  if (!template) return null;
  const [studio] = await db
    .select({ name: photographers.name, businessName: photographers.businessName, email: photographers.email, timeZone: photographers.timeZone })
    .from(photographers)
    .where(eq(photographers.id, invoice.photographerId));
  const deposit = invoice.schedule[0]?.label === "Deposit" ? invoice.schedule[0].amountCents : 0;
  const content = sanitizeRichText(
    fillPlaceholders(template.content, {
      CLIENT_NAME: invoice.clientName,
      CLIENT_EMAIL: invoice.clientEmail,
      CLIENT_PHONE: invoice.clientPhone ?? "Not given",
      SESSION_NAME: invoice.title,
      BOOKING_DATE: invoice.eventDate ? formatDay(invoice.eventDate) : "To be scheduled",
      BOOKING_TIME: "To be scheduled",
      PHOTOGRAPHER_NAME: studio.name,
      STUDIO_NAME: studio.businessName ?? studio.name,
      STUDIO_EMAIL: studio.email,
      TOTAL_AMOUNT: formatPrice(invoice.totalCents),
      DEPOSIT_AMOUNT: formatPrice(deposit),
      CREDIT_APPLIED: formatPrice(0),
      BALANCE_DUE: formatPrice(Math.max(0, invoice.totalCents - deposit)),
      TODAY_DATE: formatDate(new Date(), studio.timeZone).replace(/^\w+, /, ""),
    }),
  );
  return { title: template.title, content };
}

// Adds up what's been paid (online and recorded by the studio) and updates
// the status. Returns the invoice as it is now.
export async function refreshPaid(invoiceId: string) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice) return null;
  const [online] = await db
    .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "paid")));
  const manual = invoice.manualPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const paidCents = online.cents + manual;
  const update: Partial<typeof invoices.$inferInsert> = { paidCents, updatedAt: new Date() };
  if (invoice.status !== "cancelled" && invoice.status !== "declined" && invoice.status !== "draft") {
    if (paidCents > 0) update.status = statusAfterPayment(invoice.totalCents, paidCents);
    else if (invoice.status === "partial" || invoice.status === "paid") update.status = invoice.approvedAt ? "approved" : "sent";
    if (update.status === "paid" && !invoice.paidAt) update.paidAt = new Date();
    if (update.status !== "paid") update.paidAt = null;
  }
  const [row] = await db.update(invoices).set(update).where(eq(invoices.id, invoiceId)).returning();
  return row;
}

// What the client is asked for: the next scheduled payment, or everything left.
export function amountToPay(invoice: Invoice, which: "next" | "full") {
  if (!canPay(invoice.kind, invoice.status)) return null;
  const balance = balanceCents(invoice.totalCents, invoice.paidCents);
  if (balance <= 0) return null;
  if (which === "full") return { label: "Balance", amountCents: balance };
  const next = nextScheduled(invoice.schedule, invoice.paidCents);
  return next ? { label: next.label, amountCents: Math.min(next.amountCents, balance) } : null;
}
