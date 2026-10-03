// Quotes and invoices (ported from InvoiceEZ): line item totals, tax, and the
// payment schedule (paid in full, a deposit and the balance, or a payment
// plan of installments), what's due next, and the status a client sees.
// Pure logic with no database, tested in math.test.ts.

export const INVOICE_KINDS = ["quote", "invoice"] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

// draft: not sent yet. sent: waiting on the client (a quote's approval, or an
// invoice's payment). approved: a quote the client accepted. partial: some
// paid. Overdue isn't stored; it's worked out from the schedule's due dates.
export const INVOICE_STATUSES = ["draft", "sent", "approved", "declined", "partial", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type LineItem = { description: string; quantity: number; unitCents: number };

// How the client pays, as chosen in the editor (kept so the editor can reopen it).
export type PaymentPlan =
  | { mode: "full" }
  | { mode: "deposit"; depositPercent: number }
  | { mode: "installments"; depositPercent: number; count: number; every: Every; firstDue: string };
export type Every = "month" | "2weeks" | "week";

// One payment in the schedule. dueDate is a studio-calendar day like
// "2026-11-01"; null means due now (a deposit, due when the client says yes).
export type ScheduledPayment = { label: string; amountCents: number; dueDate: string | null };

export const MAX_INSTALLMENTS = 24;

export function lineTotal(item: LineItem) {
  return Math.round(item.quantity * item.unitCents);
}

// Tax is a rate in basis points (725 = 7.25%), on the whole subtotal.
export function invoiceTotals(items: LineItem[], taxBps: number) {
  const subtotalCents = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const taxCents = Math.round((subtotalCents * taxBps) / 10_000);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

// "7.25" → 725; blank → 0. Null when it isn't a rate.
export function parseTaxRate(text: string): number | null {
  const value = text.trim().replace(/%$/, "").trim();
  if (value === "") return 0;
  if (!/^\d{1,2}(\.\d{1,3})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

export function formatTaxRate(bps: number) {
  return `${Number((bps / 100).toFixed(3))}%`;
}

// "2026-10-31" plus whole days, months (clamped to the month's last day:
// Jan 31 + 1 month = Feb 28), or weeks.
export function addToDate(date: string, amount: number, unit: "day" | "month"): string {
  const [y, m, d] = date.split("-").map(Number);
  if (unit === "day") {
    const next = new Date(Date.UTC(y, m - 1, d + amount));
    return next.toISOString().slice(0, 10);
  }
  const monthIndex = m - 1 + amount;
  const year = y + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

function installmentDate(firstDue: string, index: number, every: Every) {
  if (every === "month") return addToDate(firstDue, index, "month");
  return addToDate(firstDue, index * (every === "week" ? 7 : 14), "day");
}

// The payments the client makes, in order. They always add up to the total;
// a payment plan's rounding goes on its last installment.
export function buildSchedule(totalCents: number, plan: PaymentPlan, dueDate: string | null): ScheduledPayment[] {
  if (totalCents <= 0) return [];
  const deposit = plan.mode === "full" ? 0 : Math.min(totalCents, Math.round((totalCents * plan.depositPercent) / 100));

  if (plan.mode === "installments") {
    const rows: ScheduledPayment[] = deposit > 0 ? [{ label: "Deposit", amountCents: deposit, dueDate: null }] : [];
    const rest = totalCents - deposit;
    if (rest <= 0) return rows;
    const count = Math.max(1, Math.min(MAX_INSTALLMENTS, Math.floor(plan.count)));
    const each = Math.floor(rest / count);
    for (let i = 0; i < count; i++) {
      rows.push({
        label: `Payment ${i + 1} of ${count}`,
        amountCents: i === count - 1 ? rest - each * (count - 1) : each,
        dueDate: installmentDate(plan.firstDue, i, plan.every),
      });
    }
    return rows;
  }
  if (deposit > 0 && deposit < totalCents) {
    return [
      { label: "Deposit", amountCents: deposit, dueDate: null },
      { label: "Balance", amountCents: totalCents - deposit, dueDate },
    ];
  }
  return [{ label: "Payment in full", amountCents: totalCents, dueDate }];
}

// The last day anything is due (the invoice's due date in lists).
export function finalDueDate(schedule: ScheduledPayment[]): string | null {
  const dates = schedule.map((p) => p.dueDate).filter((d): d is string => d !== null);
  return dates.length ? dates.sort().at(-1)! : null;
}

export type PaymentRow = ScheduledPayment & {
  paidCents: number;
  state: "paid" | "partly_paid" | "due" | "overdue" | "upcoming";
};

// Each scheduled payment with how much of it is paid. Money paid goes to the
// earliest payments first, so paying ahead simply covers later ones. The
// first unpaid payment is "due" (or "overdue" once its day has passed).
export function scheduleRows(schedule: ScheduledPayment[], paidCents: number, today: string): PaymentRow[] {
  let left = paidCents;
  let foundDue = false;
  return schedule.map((p) => {
    const paid = Math.min(p.amountCents, Math.max(0, left));
    left -= paid;
    let state: PaymentRow["state"];
    if (paid >= p.amountCents) state = "paid";
    else if (!foundDue) {
      foundDue = true;
      state = p.dueDate && p.dueDate < today ? "overdue" : paid > 0 ? "partly_paid" : "due";
    } else state = p.dueDate && p.dueDate < today ? "overdue" : "upcoming";
    return { ...p, paidCents: paid, state };
  });
}

// The next payment to ask for: what's left of the first unpaid one. Null when paid up.
export function nextScheduled(schedule: ScheduledPayment[], paidCents: number) {
  let covered = 0;
  for (let index = 0; index < schedule.length; index++) {
    covered += schedule[index].amountCents;
    if (covered > paidCents) {
      return { index, label: schedule[index].label, amountCents: covered - paidCents, dueDate: schedule[index].dueDate };
    }
  }
  return null;
}

export function balanceCents(totalCents: number, paidCents: number) {
  return Math.max(0, totalCents - paidCents);
}

// Status after a payment: paid in full, or partly paid.
export function statusAfterPayment(totalCents: number, paidCents: number): "paid" | "partial" {
  return paidCents >= totalCents ? "paid" : "partial";
}

// Whether the client can pay now: an invoice once it's sent, a quote once
// they've approved it, and not when cancelled, declined, or paid.
export function canPay(kind: InvoiceKind, status: InvoiceStatus) {
  if (status === "partial") return true;
  return kind === "invoice" ? status === "sent" : status === "approved";
}

export function isOverdue(schedule: ScheduledPayment[], paidCents: number, status: InvoiceStatus, today: string) {
  if (status !== "sent" && status !== "approved" && status !== "partial") return false;
  const next = nextScheduled(schedule, paidCents);
  return Boolean(next?.dueDate && next.dueDate < today);
}

// What the studio sees in lists, e.g. "Overdue" or "Approved".
export function statusLabel(kind: InvoiceKind, status: InvoiceStatus, overdue: boolean) {
  if (overdue) return "Overdue";
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return kind === "quote" ? "Awaiting approval" : "Sent";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    case "partial":
      return "Partly paid";
    case "paid":
      return "Paid";
    case "cancelled":
      return "Cancelled";
  }
}

// Q-2026-0001 / INV-2026-0001.
export function invoiceNumber(kind: InvoiceKind, year: number, sequence: number) {
  return `${kind === "quote" ? "Q" : "INV"}-${year}-${String(sequence).padStart(4, "0")}`;
}

// The sequence in a number from the same kind and year, or 0 when it's another series.
export function sequenceOf(number: string, kind: InvoiceKind, year: number) {
  const match = new RegExp(`^${kind === "quote" ? "Q" : "INV"}-${year}-(\\d+)$`).exec(number);
  return match ? Number(match[1]) : 0;
}

// Plain words for a plan, e.g. "50% deposit, then 3 monthly payments".
export function describePlan(plan: PaymentPlan) {
  if (plan.mode === "full") return "Paid in full";
  if (plan.mode === "deposit") return `${plan.depositPercent}% deposit, then the balance`;
  const often = plan.every === "month" ? "monthly" : plan.every === "week" ? "weekly" : "every-2-weeks";
  const payments = `${plan.count} ${often} payment${plan.count === 1 ? "" : "s"}`;
  return plan.depositPercent > 0 ? `${plan.depositPercent}% deposit, then ${payments}` : payments;
}

// "2026-11-30" → "Monday, November 30, 2026" (or "Nov 30, 2026" short).
export function formatDay(date: string, style: "long" | "short" = "long") {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
    "en-US",
    style === "long"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }
      : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  );
}
