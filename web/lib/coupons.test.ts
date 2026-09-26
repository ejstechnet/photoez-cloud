// Tests for coupon codes.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCoupon, couponDiscount, normalizeCode, type Coupon } from "./coupons.ts";

const spring: Coupon = {
  code: "SPRING20",
  kind: "percent",
  value: 20,
  sessionTypeIds: [],
  startsOn: "2026-03-01",
  endsOn: "2026-05-31",
  maxUses: 10,
  maxUsesPerClient: null,
  active: true,
};
const booking = { sessionTypeId: "maternity", totalCents: 28000, today: "2026-04-15", uses: 3 };

test("codes are matched however the client types them", () => {
  assert.equal(normalizeCode(" spring 20 "), "SPRING20");
});

test("percent and dollar discounts, never more than the total", () => {
  assert.equal(couponDiscount({ kind: "percent", value: 20 }, 28000), 5600);
  assert.equal(couponDiscount({ kind: "amount", value: 5000 }, 28000), 5000);
  assert.equal(couponDiscount({ kind: "amount", value: 50000 }, 28000), 28000);
});

test("a valid code takes its discount off the whole total", () => {
  assert.deepEqual(checkCoupon(spring, booking), { ok: true, discountCents: 5600 });
});

test("a per-client limit counts only that client's bookings", () => {
  const once = { ...spring, maxUsesPerClient: 1 };
  assert.equal(checkCoupon(once, { ...booking, clientUses: 0 }).ok, true);
  assert.deepEqual(checkCoupon(once, { ...booking, clientUses: 1 }), { ok: false, message: "You've already used this code." });
});

test("dates, sessions, use limits, and switched-off codes are enforced", () => {
  assert.equal(checkCoupon(spring, { ...booking, today: "2026-02-28" }).ok, false);
  assert.equal(checkCoupon(spring, { ...booking, today: "2026-06-01" }).ok, false);
  assert.equal(checkCoupon({ ...spring, sessionTypeIds: ["boudoir"] }, booking).ok, false);
  assert.equal(checkCoupon(spring, { ...booking, uses: 10 }).ok, false);
  assert.equal(checkCoupon({ ...spring, active: false }, booking).ok, false);
  assert.equal(checkCoupon(null, booking).ok, false);
});
