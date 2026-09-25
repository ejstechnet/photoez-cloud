// What a booking costs, what's been paid, and what to ask for next: the
// deposit at booking, then the balance (like PhotoEZ Booking's deposit order
// followed by a balance invoice). Pure logic, tested in amounts.test.ts.

import { depositCents } from "../booking/format.ts";

export type Priced = { priceCents: number; addonsCents: number; depositPercent: number };
export type Paid = { kind: "deposit" | "balance" | "gallery_extras"; amountCents: number; status: "pending" | "paid" | "expired" };

export function bookingTotal(b: Priced) {
  return b.priceCents + b.addonsCents;
}

export function amountPaid(payments: Paid[]) {
  return payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amountCents, 0);
}

export function balanceDue(b: Priced, payments: Paid[]) {
  return Math.max(0, bookingTotal(b) - amountPaid(payments));
}

// The next payment to ask for, or null when nothing more is owed.
export function nextPayment(b: Priced, payments: Paid[]): { kind: "deposit" | "balance"; amountCents: number } | null {
  const depositPaid = payments.some((p) => p.kind === "deposit" && p.status === "paid");
  const deposit = depositCents(bookingTotal(b), b.depositPercent);
  if (!depositPaid && deposit > 0) return { kind: "deposit", amountCents: Math.min(deposit, balanceDue(b, payments)) };
  const balance = balanceDue(b, payments);
  return balance > 0 ? { kind: "balance", amountCents: balance } : null;
}
