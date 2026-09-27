// Tests for the Bookings calendar grid.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { inRange, isMonth, monthGrid, monthTitle } from "./calendar.ts";

test("October 2026 starts on Thursday, in whole Sunday-first weeks", () => {
  const weeks = monthGrid("2026-10");
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0], "2026-09-27");
  assert.equal(weeks[0][4], "2026-10-01");
  assert.equal(weeks[4][6], "2026-10-31");
});

test("a month needing six rows gets six", () => {
  // August 2026 starts on a Saturday and has 31 days.
  const weeks = monthGrid("2026-08");
  assert.equal(weeks.length, 6);
  assert.ok(weeks.every((w) => w.length === 7));
});

test("February 2026 fits in four rows when it starts on Sunday", () => {
  assert.equal(monthGrid("2026-02").length, 4);
});

test("month values are checked and titled", () => {
  assert.ok(isMonth("2026-12"));
  assert.ok(!isMonth("2026-13"));
  assert.ok(!isMonth("../x"));
  assert.equal(monthTitle("2026-10"), "October 2026");
  assert.ok(inRange("2026-10-05", "2026-10-01", "2026-10-05"));
  assert.ok(!inRange("2026-10-06", "2026-10-01", "2026-10-05"));
});
