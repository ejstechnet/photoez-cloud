// Tests for plans, prices, limits, and the trial.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PLAN_LIMITS,
  PLAN_PRICES,
  effectivePlan,
  formatStorage,
  hasFeature,
  planFor,
  planFromLookupKey,
  priceLookupKey,
  trialDaysLeft,
} from "./plans.ts";

const now = new Date("2026-10-01T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86400000);

test("the trial gives a Free studio Pro, then ends", () => {
  assert.equal(effectivePlan("free", days(3), now), "pro");
  assert.equal(effectivePlan("free", days(-1), now), "free");
  assert.equal(effectivePlan("free", null, now), "free");
  // A paying studio keeps its own plan.
  assert.equal(effectivePlan("studio", days(3), now), "studio");
  assert.equal(trialDaysLeft(days(13.5), now), 14);
  assert.equal(trialDaysLeft(days(-2), now), 0);
});

test("prices: yearly is two months free", () => {
  assert.equal(PLAN_PRICES.pro.month, 1900);
  assert.equal(PLAN_PRICES.pro.year, PLAN_PRICES.pro.month * 10);
  assert.equal(PLAN_PRICES.studio.year, PLAN_PRICES.studio.month * 10);
});

test("Stripe lookup keys round-trip", () => {
  assert.equal(priceLookupKey("studio", "year"), "photoez_studio_year");
  assert.deepEqual(planFromLookupKey("photoez_pro_month"), { plan: "pro", interval: "month" });
  assert.equal(planFromLookupKey("something_else"), null);
});

test("what each plan includes and allows", () => {
  assert.equal(PLAN_LIMITS.free.activeGalleries, 3);
  assert.equal(PLAN_LIMITS.pro.activeGalleries, null);
  assert.ok(!hasFeature("free", "aiSearch") && hasFeature("pro", "aiSearch"));
  assert.ok(!hasFeature("pro", "removeBranding") && hasFeature("studio", "removeBranding"));
  assert.equal(planFor("removeBranding"), "studio");
  assert.equal(formatStorage(3 * 1024 ** 3), "3 GB");
  assert.equal(formatStorage(250 * 1024 ** 2), "250 MB");
});

test("a referral earns a month of the referrer's plan, or of Pro on Free", async () => {
  const { referralRewardCents } = await import("./plans.ts");
  assert.equal(referralRewardCents("studio"), 3900);
  assert.equal(referralRewardCents("pro"), 1900);
  assert.equal(referralRewardCents("free"), 1900);
});
