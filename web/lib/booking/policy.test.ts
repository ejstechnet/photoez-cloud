// Tests for client self-service rules.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { clientOptions, type ChangePolicy, type ClientBooking } from "./policy.ts";

// Elle's rules: reschedule once for free up to 48 hours ahead; cancel more
// than 72 hours ahead and the deposit becomes a credit.
const policy: ChangePolicy = { enabled: true, rescheduleNoticeHours: 48, freeReschedules: 1, cancelNoticeHours: 72 };
const now = new Date("2026-10-01T12:00:00Z");
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);
const booking = (hours: number, extra: Partial<ClientBooking> = {}): ClientBooking => ({
  status: "confirmed",
  startsAt: hoursFromNow(hours),
  rescheduleCount: 0,
  depositPercent: 50,
  ...extra,
});

test("well ahead: reschedule, and cancel with a credit", () => {
  const o = clientOptions(booking(100), policy, now);
  assert.deepEqual(o.reschedule, { allowed: true });
  assert.deepEqual(o.cancel, { allowed: true, creditDue: true });
});

test("between 48 and 72 hours: reschedule, but cancelling forfeits the deposit", () => {
  const o = clientOptions(booking(60), policy, now);
  assert.deepEqual(o.reschedule, { allowed: true });
  assert.deepEqual(o.cancel, { allowed: true, creditDue: false });
});

test("inside 48 hours: no online reschedule", () => {
  assert.deepEqual(clientOptions(booking(47), policy, now).reschedule, { allowed: false, reason: "too_late" });
  assert.deepEqual(clientOptions(booking(48), policy, now).reschedule, { allowed: true });
});

test("exactly 72 hours ahead is not 'more than' 72", () => {
  assert.deepEqual(clientOptions(booking(72), policy, now).cancel, { allowed: true, creditDue: false });
});

test("free reschedules run out", () => {
  const o = clientOptions(booking(100, { rescheduleCount: 1 }), policy, now);
  assert.deepEqual(o.reschedule, { allowed: false, reason: "limit_reached" });
});

test("no deposit means no credit to carry over", () => {
  assert.deepEqual(clientOptions(booking(100, { depositPercent: 0 }), policy, now).cancel, { allowed: true, creditDue: false });
});

test("past, cancelled, or completed bookings can't be changed", () => {
  for (const b of [booking(-1), booking(100, { status: "cancelled" }), booking(100, { status: "completed" })]) {
    const o = clientOptions(b, policy, now);
    assert.deepEqual(o.reschedule, { allowed: false, reason: "not_active" });
    assert.deepEqual(o.cancel, { allowed: false, reason: "not_active" });
  }
});

test("the studio can turn self-service off", () => {
  const o = clientOptions(booking(100), { ...policy, enabled: false }, now);
  assert.deepEqual(o.reschedule, { allowed: false, reason: "turned_off" });
  assert.deepEqual(o.cancel, { allowed: false, reason: "turned_off" });
});
