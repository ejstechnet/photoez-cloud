// The Growth pipeline's rules.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveScore, statusChangeProblem, tierFor } from "./pipeline.ts";

test("stages from 'they responded' on need evidence; earlier ones don't", () => {
  assert.equal(statusChangeProblem("new", "reviewed", null), null);
  assert.equal(statusChangeProblem("approved", "engaged", ""), null);
  assert.match(statusChangeProblem("engaged", "responded", "  ") ?? "", /Say what happened/);
  assert.match(statusChangeProblem("responded", "trial_started", null) ?? "", /Trial started/);
  assert.equal(statusChangeProblem("engaged", "responded", "She asked how proofing works"), null);
  assert.match(statusChangeProblem("new", "new", null) ?? "", /already/);
});

test("scores become the spec's tiers", () => {
  assert.equal(tierFor(null), null);
  assert.equal(tierFor(100), "high");
  assert.equal(tierFor(80), "high");
  assert.equal(tierFor(79), "review");
  assert.equal(tierFor(50), "review");
  assert.equal(tierFor(49), "low");
  assert.equal(tierFor(0), "low");
});

test("Elle's own score wins over the AI's", () => {
  assert.equal(effectiveScore(40, 85), 85);
  assert.equal(effectiveScore(40, null), 40);
  assert.equal(effectiveScore(null, null), null);
});
