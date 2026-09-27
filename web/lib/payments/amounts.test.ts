// Tests for booking payment amounts.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { balanceDue, bookingDeposit, nextPayment, type Paid } from "./amounts.ts";

// $250 session + $30 extras, 50% deposit.
const booking = { priceCents: 25000, addonsCents: 3000, depositPercent: 50 };

test("first the deposit, on the total including extras", () => {
  assert.deepEqual(nextPayment(booking, []), { kind: "deposit", amountCents: 14000 });
});

test("then the balance, once the deposit is paid", () => {
  const paid: Paid[] = [{ kind: "deposit", amountCents: 14000, status: "paid" }];
  assert.deepEqual(nextPayment(booking, paid), { kind: "balance", amountCents: 14000 });
  assert.equal(balanceDue(booking, paid), 14000);
});

test("nothing more once everything is paid", () => {
  const paid: Paid[] = [
    { kind: "deposit", amountCents: 14000, status: "paid" },
    { kind: "balance", amountCents: 14000, status: "paid" },
  ];
  assert.equal(nextPayment(booking, paid), null);
});

test("abandoned checkouts don't count as paid", () => {
  const tried: Paid[] = [{ kind: "deposit", amountCents: 14000, status: "expired" }];
  assert.deepEqual(nextPayment(booking, tried), { kind: "deposit", amountCents: 14000 });
});

test("a coupon lowers the total, and the deposit with it", () => {
  // $280 - $28 (10% coupon) = $252; 50% deposit = $126.
  assert.deepEqual(nextPayment({ ...booking, discountCents: 2800 }, []), { kind: "deposit", amountCents: 12600 });
});

test("the deposit is its percentage of what's left after credit", () => {
  // Elle's example: $215 total, $100 credit, 50% deposit → 50% of $115 = $57.50.
  const elle = { priceCents: 21500, addonsCents: 0, depositPercent: 50, creditCents: 10000 };
  assert.deepEqual(nextPayment(elle, []), { kind: "deposit", amountCents: 5750 });
  assert.equal(bookingDeposit(elle), 5750);
  // Then the rest of what's left is the balance.
  const paid: Paid[] = [{ kind: "deposit", amountCents: 5750, status: "paid" }];
  assert.deepEqual(nextPayment(elle, paid), { kind: "balance", amountCents: 5750 });
  // Credit covering everything: nothing owed.
  assert.equal(nextPayment({ ...booking, creditCents: 28000 }, []), null);
});

test("gift cards work the same way as credit", () => {
  // $280 total, $80 gift card, 50% deposit → 50% of $200 = $100.
  assert.deepEqual(nextPayment({ ...booking, giftCardCents: 8000 }, []), { kind: "deposit", amountCents: 10000 });
  // Credit and a gift card together.
  assert.deepEqual(nextPayment({ ...booking, creditCents: 8000, giftCardCents: 12000 }, []), {
    kind: "deposit",
    amountCents: 4000,
  });
});

test("no deposit asked means pay the full amount as the balance", () => {
  assert.deepEqual(nextPayment({ ...booking, depositPercent: 0 }, []), { kind: "balance", amountCents: 28000 });
  assert.deepEqual(nextPayment({ ...booking, depositPercent: 100 }, []), { kind: "deposit", amountCents: 28000 });
});
