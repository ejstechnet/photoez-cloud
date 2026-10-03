// Tests for quote and invoice math.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addToDate,
  buildSchedule,
  canPay,
  describePlan,
  formatDay,
  finalDueDate,
  invoiceNumber,
  invoiceTotals,
  isOverdue,
  nextScheduled,
  parseTaxRate,
  scheduleRows,
  sequenceOf,
  statusLabel,
} from "./math.ts";

test("totals: line items, then tax on the subtotal", () => {
  const t = invoiceTotals(
    [
      { description: "Wedding coverage", quantity: 1, unitCents: 250000 },
      { description: "Prints", quantity: 3, unitCents: 1999 },
      { description: "Travel (miles)", quantity: 12.5, unitCents: 67 },
    ],
    725,
  );
  assert.equal(t.subtotalCents, 250000 + 5997 + 838);
  assert.equal(t.taxCents, Math.round((256835 * 725) / 10000));
  assert.equal(t.totalCents, t.subtotalCents + t.taxCents);
});

test("tax rates are read as percentages", () => {
  assert.equal(parseTaxRate("7.25"), 725);
  assert.equal(parseTaxRate("8%"), 800);
  assert.equal(parseTaxRate(""), 0);
  assert.equal(parseTaxRate("abc"), null);
  assert.equal(parseTaxRate("150"), null);
});

test("dates: months clamp to the month's last day", () => {
  assert.equal(addToDate("2026-01-31", 1, "month"), "2026-02-28");
  assert.equal(addToDate("2026-11-15", 3, "month"), "2027-02-15");
  assert.equal(addToDate("2026-12-28", 7, "day"), "2027-01-04");
});

test("paid in full is one payment on the due date", () => {
  assert.deepEqual(buildSchedule(50000, { mode: "full" }, "2026-11-01"), [
    { label: "Payment in full", amountCents: 50000, dueDate: "2026-11-01" },
  ]);
});

test("a deposit is due now and the balance on the due date", () => {
  assert.deepEqual(buildSchedule(50001, { mode: "deposit", depositPercent: 30 }, "2026-11-01"), [
    { label: "Deposit", amountCents: 15000, dueDate: null },
    { label: "Balance", amountCents: 35001, dueDate: "2026-11-01" },
  ]);
  // A 0% or 100% deposit is just one payment.
  assert.equal(buildSchedule(50000, { mode: "deposit", depositPercent: 0 }, null).length, 1);
  assert.equal(buildSchedule(50000, { mode: "deposit", depositPercent: 100 }, null).length, 1);
});

test("a payment plan: deposit, then equal installments with the rounding last", () => {
  const rows = buildSchedule(100000, { mode: "installments", depositPercent: 25, count: 3, every: "month", firstDue: "2026-11-30" }, null);
  assert.deepEqual(rows, [
    { label: "Deposit", amountCents: 25000, dueDate: null },
    { label: "Payment 1 of 3", amountCents: 25000, dueDate: "2026-11-30" },
    { label: "Payment 2 of 3", amountCents: 25000, dueDate: "2026-12-30" },
    { label: "Payment 3 of 3", amountCents: 25000, dueDate: "2027-01-30" },
  ]);
  const odd = buildSchedule(10000, { mode: "installments", depositPercent: 0, count: 3, every: "2weeks", firstDue: "2026-10-05" }, null);
  assert.deepEqual(
    odd.map((r) => [r.amountCents, r.dueDate]),
    [
      [3333, "2026-10-05"],
      [3333, "2026-10-19"],
      [3334, "2026-11-02"],
    ],
  );
  assert.equal(finalDueDate(odd), "2026-11-02");
});

test("money paid covers the earliest payments first", () => {
  const schedule = buildSchedule(100000, { mode: "installments", depositPercent: 25, count: 3, every: "month", firstDue: "2026-11-30" }, null);
  assert.deepEqual(nextScheduled(schedule, 0), { index: 0, label: "Deposit", amountCents: 25000, dueDate: null });
  assert.deepEqual(nextScheduled(schedule, 30000), { index: 1, label: "Payment 1 of 3", amountCents: 20000, dueDate: "2026-11-30" });
  assert.equal(nextScheduled(schedule, 100000), null);

  const rows = scheduleRows(schedule, 30000, "2026-12-05");
  assert.deepEqual(
    rows.map((r) => [r.paidCents, r.state]),
    [
      [25000, "paid"],
      [5000, "overdue"],
      [0, "upcoming"],
      [0, "upcoming"],
    ],
  );
  assert.equal(isOverdue(schedule, 30000, "partial", "2026-12-05"), true);
  assert.equal(isOverdue(schedule, 30000, "partial", "2026-11-29"), false);
  assert.equal(isOverdue(schedule, 30000, "cancelled", "2026-12-05"), false);
});

test("who can pay when", () => {
  assert.equal(canPay("invoice", "sent"), true);
  assert.equal(canPay("quote", "sent"), false);
  assert.equal(canPay("quote", "approved"), true);
  assert.equal(canPay("invoice", "paid"), false);
  assert.equal(canPay("quote", "partial"), true);
  assert.equal(statusLabel("quote", "sent", false), "Awaiting approval");
  assert.equal(statusLabel("invoice", "partial", true), "Overdue");
});

test("numbers: Q-2026-0001 and INV-2026-0012", () => {
  assert.equal(invoiceNumber("quote", 2026, 1), "Q-2026-0001");
  assert.equal(invoiceNumber("invoice", 2026, 12), "INV-2026-0012");
  assert.equal(sequenceOf("INV-2026-0012", "invoice", 2026), 12);
  assert.equal(sequenceOf("Q-2026-0012", "invoice", 2026), 0);
  assert.equal(sequenceOf("INV-2025-0012", "invoice", 2026), 0);
});

test("plans in plain words", () => {
  assert.equal(describePlan({ mode: "deposit", depositPercent: 50 }), "50% deposit, then the balance");
  assert.equal(
    describePlan({ mode: "installments", depositPercent: 0, count: 4, every: "month", firstDue: "2026-11-01" }),
    "4 monthly payments",
  );
});

test("days read the same in every time zone", () => {
  assert.equal(formatDay("2026-11-30"), "Monday, November 30, 2026");
  assert.equal(formatDay("2026-11-30", "short"), "Nov 30, 2026");
});
