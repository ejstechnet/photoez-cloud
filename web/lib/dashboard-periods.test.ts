// Tests for the dashboard's revenue periods.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { monthRange, parsePeriod, periodStart } from "./dashboard-periods.ts";

const LA = "America/Los_Angeles";

test("unknown periods fall back to this month", () => {
  assert.equal(parsePeriod("year"), "year");
  assert.equal(parsePeriod("forever"), "month");
  assert.equal(parsePeriod(undefined), "month");
});

test("this month starts at local midnight on the 1st", () => {
  // 11 pm Sept 30 in Portland is already Oct 1 in UTC; it still counts as September.
  const now = new Date("2026-10-01T06:00:00Z");
  assert.equal(periodStart("month", now, LA)?.toISOString(), "2026-09-01T07:00:00.000Z");
});

test("this year starts at local midnight on January 1", () => {
  assert.equal(periodStart("year", new Date("2026-09-26T18:00:00Z"), LA)?.toISOString(), "2026-01-01T08:00:00.000Z");
  assert.equal(periodStart("all", new Date(), LA), null);
});

test("the month range spans the whole local month", () => {
  const { start, end } = monthRange(new Date("2026-12-15T12:00:00Z"), LA);
  assert.equal(start.toISOString(), "2026-12-01T08:00:00.000Z");
  assert.equal(end.toISOString(), "2027-01-01T08:00:00.000Z");
});
