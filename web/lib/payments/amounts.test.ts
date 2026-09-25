// Tests for booking payment amounts.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { balanceDue, nextPayment, type Paid } from "./amounts.ts";

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

test("no deposit asked means pay the full amount as the balance", () => {
  assert.deepEqual(nextPayment({ ...booking, depositPercent: 0 }, []), { kind: "balance", amountCents: 28000 });
  assert.deepEqual(nextPayment({ ...booking, depositPercent: 100 }, []), { kind: "deposit", amountCents: 28000 });
});
