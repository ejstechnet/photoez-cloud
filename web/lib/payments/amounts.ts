// What a booking costs, what's been paid, and what to ask for next: the
// deposit at booking, then the balance (like PhotoEZ Booking's deposit order
// followed by a balance invoice). A coupon lowers the total; session credit
// and gift cards the client used count as already paid. Pure logic, tested in amounts.test.ts.

import { depositCents } from "../booking/format.ts";

export type Priced = {
  priceCents: number;
  addonsCents: number;
  depositPercent: number;
  discountCents?: number;
  creditCents?: number;
  giftCardCents?: number;
};
export type Paid = { kind: "deposit" | "balance" | "gallery_extras" | "gift_card"; amountCents: number; status: "pending" | "paid" | "expired" };

// Session + extras, less any coupon.
export function bookingTotal(b: Priced) {
  return Math.max(0, b.priceCents + b.addonsCents - (b.discountCents ?? 0));
}

// Paid online, plus any session credit or gift card put toward it.
export function amountPaid(payments: Paid[], b?: Priced) {
  const online = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amountCents, 0);
  return online + prepaid(b);
}

// Session credit and gift card amounts on a booking (not online payments).
export function prepaid(b?: Priced) {
  return (b?.creditCents ?? 0) + (b?.giftCardCents ?? 0);
}

export function balanceDue(b: Priced, payments: Paid[]) {
  return Math.max(0, bookingTotal(b) - amountPaid(payments, b));
}

// The deposit: its percentage of what's left after session credit and gift
// cards ($215 with a $100 credit and a 50% deposit → 50% of $115 = $57.50).
export function bookingDeposit(b: Priced) {
  return depositCents(Math.max(0, bookingTotal(b) - prepaid(b)), b.depositPercent);
}

// The next payment to ask for, or null when nothing more is owed. The
// deposit is due until what's been paid online covers it; then the balance.
export function nextPayment(b: Priced, payments: Paid[]): { kind: "deposit" | "balance"; amountCents: number } | null {
  const paidOnline = amountPaid(payments);
  const deposit = bookingDeposit(b);
  if (paidOnline < deposit) return { kind: "deposit", amountCents: deposit - paidOnline };
  const balance = balanceDue(b, payments);
  return balance > 0 ? { kind: "balance", amountCents: balance } : null;
}
