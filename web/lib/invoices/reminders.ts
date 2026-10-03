import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices, photographers } from "@/db/schema";
import { localDateOf } from "@/lib/booking/time";
import { addToDate, canPay, nextScheduled } from "./math";
import { emailPaymentDue, emailQuoteReminder } from "./notify";

// InvoiceEZ's automatic emails, run with the other reminders every 15
// minutes (lib/email/reminders.ts):
//  - a quote nobody has answered, 3 days after it was sent (once);
//  - each scheduled payment, 3 days before it's due;
//  - each scheduled payment the day after it was due, if still unpaid.
// Each is claimed before it's sent, so two runs at once can't send twice.

const DAY = 24 * 60 * 60 * 1000;
export const REMIND_DAYS_BEFORE = 3;
const QUOTE_REMINDER_DAYS = 3;

export async function sendInvoiceReminders(now = new Date()) {
  const sent = { quotes: 0, upcoming: 0, overdue: 0 };
  const open = await db
    .select({ invoice: invoices, timeZone: photographers.timeZone })
    .from(invoices)
    .innerJoin(photographers, eq(photographers.id, invoices.photographerId))
    .where(inArray(invoices.status, ["sent", "approved", "partial"]));

  for (const { invoice, timeZone } of open) {
    if (invoice.kind === "quote" && invoice.status === "sent") {
      if (invoice.approvalReminderAt || !invoice.sentAt || now.getTime() - invoice.sentAt.getTime() < QUOTE_REMINDER_DAYS * DAY) continue;
      const [claimed] = await db
        .update(invoices)
        .set({ approvalReminderAt: now })
        .where(and(eq(invoices.id, invoice.id), isNull(invoices.approvalReminderAt)))
        .returning({ id: invoices.id });
      if (claimed && (await emailQuoteReminder(invoice.id))) sent.quotes++;
      continue;
    }

    if (!canPay(invoice.kind, invoice.status)) continue;
    const next = nextScheduled(invoice.schedule, invoice.paidCents);
    if (!next?.dueDate) continue;
    const today = localDateOf(now, timeZone);
    const key = `${next.index}:${next.dueDate}`;

    if (next.dueDate < today) {
      if (invoice.overdueNoticeKey === key) continue;
      const [claimed] = await db
        .update(invoices)
        .set({ overdueNoticeKey: key })
        .where(and(eq(invoices.id, invoice.id), sql`${invoices.overdueNoticeKey} is distinct from ${key}`))
        .returning({ id: invoices.id });
      if (claimed && (await emailPaymentDue(invoice.id, true))) sent.overdue++;
    } else if (next.dueDate <= addToDate(today, REMIND_DAYS_BEFORE, "day")) {
      if (invoice.paymentReminderKey === key) continue;
      const [claimed] = await db
        .update(invoices)
        .set({ paymentReminderKey: key })
        .where(and(eq(invoices.id, invoice.id), sql`${invoices.paymentReminderKey} is distinct from ${key}`))
        .returning({ id: invoices.id });
      // Sent in the last day: that email already said what's due.
      const justSent = invoice.sentAt && now.getTime() - invoice.sentAt.getTime() < DAY;
      if (claimed && !justSent && (await emailPaymentDue(invoice.id, false))) sent.upcoming++;
    }
  }
  return sent;
}
