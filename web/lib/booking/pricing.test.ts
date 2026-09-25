// Tests for special prices.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { currentPrice } from "./pricing.ts";

const session = { priceCents: 25000, salePriceCents: 20000, saleEndsOn: "2026-10-31" };

test("on sale through the end date, inclusive", () => {
  assert.deepEqual(currentPrice(session, "2026-10-01"), { priceCents: 20000, wasCents: 25000 });
  assert.deepEqual(currentPrice(session, "2026-10-31"), { priceCents: 20000, wasCents: 25000 });
});

test("back to the regular price after the sale ends", () => {
  assert.deepEqual(currentPrice(session, "2026-11-01"), { priceCents: 25000, wasCents: null });
});

test("a sale with no end date lasts until it's removed", () => {
  assert.deepEqual(currentPrice({ ...session, saleEndsOn: null }, "2030-01-01"), { priceCents: 20000, wasCents: 25000 });
});

test("no sale price, or one that isn't lower, means the regular price", () => {
  assert.deepEqual(currentPrice({ ...session, salePriceCents: null }, "2026-10-01"), { priceCents: 25000, wasCents: null });
  assert.deepEqual(currentPrice({ ...session, salePriceCents: 30000 }, "2026-10-01"), { priceCents: 25000, wasCents: null });
});
