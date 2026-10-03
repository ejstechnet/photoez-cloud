// Tests for plans, prices, limits, and the trial.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_ASSISTANT_ALLOWANCE,
  AI_PHOTO_ALLOWANCE,
  PLAN_LIMITS,
  TRIAL_AI_ASSISTANT_ALLOWANCE,
  TRIAL_AI_PHOTO_ALLOWANCE,
  aiAssistantLimit,
  aiPhotoLimit,
  onTrial,
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
  assert.equal(PLAN_PRICES.pro.month, 2900);
  assert.equal(PLAN_PRICES.studio.month, 4900);
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
  // Free gets a small AI taste; Pro and Studio get far more.
  assert.ok(hasFeature("free", "aiSearch"));
  assert.ok(AI_PHOTO_ALLOWANCE.free > 0 && AI_PHOTO_ALLOWANCE.free < AI_PHOTO_ALLOWANCE.pro);
  assert.ok(AI_ASSISTANT_ALLOWANCE.free > 0 && AI_ASSISTANT_ALLOWANCE.free < AI_ASSISTANT_ALLOWANCE.pro);
  assert.ok(!hasFeature("free", "galleryUpsells") && hasFeature("pro", "galleryUpsells"));
  assert.ok(!hasFeature("pro", "removeBranding") && hasFeature("studio", "removeBranding"));
  assert.ok(!hasFeature("free", "invoices") && hasFeature("pro", "invoices") && hasFeature("studio", "invoices"));
  assert.ok(!hasFeature("free", "textMessages") && hasFeature("pro", "textMessages"));
  assert.ok(!hasFeature("free", "slideshow") && hasFeature("pro", "slideshow") && hasFeature("studio", "slideshow"));
  assert.equal(planFor("removeBranding"), "studio");
  assert.equal(formatStorage(3 * 1024 ** 3), "3 GB");
  assert.equal(formatStorage(2048 * 1024 ** 3), "2 TB");
  assert.equal(formatStorage(1536 * 1024 ** 3), "1.5 TB");
  assert.equal(formatStorage(250 * 1024 ** 2), "250 MB");
});

test("a referral earns a month of the referrer's plan, or of Pro on Free", async () => {
  const { referralRewardCents } = await import("./plans.ts");
  assert.equal(referralRewardCents("studio"), 4900);
  assert.equal(referralRewardCents("pro"), 2900);
  assert.equal(referralRewardCents("free"), 2900);
});

test("AI is capped during the trial, between Free's and Pro's allowance", () => {
  assert.ok(TRIAL_AI_PHOTO_ALLOWANCE > AI_PHOTO_ALLOWANCE.free && TRIAL_AI_PHOTO_ALLOWANCE < AI_PHOTO_ALLOWANCE.pro);
  assert.ok(TRIAL_AI_ASSISTANT_ALLOWANCE > AI_ASSISTANT_ALLOWANCE.free && TRIAL_AI_ASSISTANT_ALLOWANCE < AI_ASSISTANT_ALLOWANCE.pro);
  assert.ok(onTrial("free", days(3), now) && !onTrial("free", days(-1), now) && !onTrial("pro", days(3), now));
  assert.equal(aiPhotoLimit("free", days(3), now), TRIAL_AI_PHOTO_ALLOWANCE);
  assert.equal(aiAssistantLimit("free", days(3), now), TRIAL_AI_ASSISTANT_ALLOWANCE);
  // After the trial, Free's own amount; paid plans are never capped.
  assert.equal(aiPhotoLimit("free", days(-1), now), AI_PHOTO_ALLOWANCE.free);
  assert.equal(aiPhotoLimit("pro", null, now), AI_PHOTO_ALLOWANCE.pro);
  assert.equal(aiAssistantLimit("studio", days(3), now), AI_ASSISTANT_ALLOWANCE.studio);
});
