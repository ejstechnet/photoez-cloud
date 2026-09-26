// What a booking costs, what's been paid, and what to ask for next: the
// deposit at booking, then the balance (like PhotoEZ Booking's deposit order
// followed by a balance invoice). A coupon lowers the total; session credit
// the client used counts as already paid. Pure logic, tested in amounts.test.ts.

import { depositCents } from "../booking/format.ts";

export type Priced = {
  priceCents: number;
  addonsCents: number;
  depositPercent: number;
  discountCents?: number;
  creditCents?: number;
};
export type Paid = { kind: "deposit" | "balance" | "gallery_extras"; amountCents: number; status: "pending" | "paid" | "expired" };

// Session + extras, less any coupon.
export function bookingTotal(b: Priced) {
  return Math.max(0, b.priceCents + b.addonsCents - (b.discountCents ?? 0));
}

// Paid online, plus any session credit put toward it.
export function amountPaid(payments: Paid[], b?: Priced) {
  const online = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amountCents, 0);
  return online + (b?.creditCents ?? 0);
}

export function balanceDue(b: Priced, payments: Paid[]) {
  return Math.max(0, bookingTotal(b) - amountPaid(payments, b));
}

// The next payment to ask for, or null when nothing more is owed. The
// deposit is due until what's been paid (online or by credit) covers it.
export function nextPayment(b: Priced, payments: Paid[]): { kind: "deposit" | "balance"; amountCents: number } | null {
  const paid = amountPaid(payments, b);
  const deposit = depositCents(bookingTotal(b), b.depositPercent);
  if (paid < deposit) return { kind: "deposit", amountCents: deposit - paid };
  const balance = balanceDue(b, payments);
  return balance > 0 ? { kind: "balance", amountCents: balance } : null;
}
