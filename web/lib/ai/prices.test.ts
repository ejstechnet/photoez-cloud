// Cost math for the AI cost report.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { costMicrodollars, modelFamily, priceFor, priceKey, tokensFromApi, uncachedCostMicrodollars, type ModelPrice } from "./prices.ts";

const tokens = { input: 1000, cacheWrite: 2000, cacheRead: 10_000, output: 500 };

test("each model's cost, including cache writes and reads, in microdollars", () => {
  const at = new Date("2026-10-05T12:00:00Z");
  // Opus 5: 1000×5 + 2000×6.25 + 10000×0.5 + 500×25
  assert.equal(costMicrodollars(tokens, priceFor("claude-opus-5", at)!), 35_000);
  // Sonnet 5: 1000×2 + 2000×2.5 + 10000×0.2 + 500×10
  assert.equal(costMicrodollars(tokens, priceFor("claude-sonnet-5", at)!), 14_000);
  // Haiku 4.5: 1000×1 + 2000×1.25 + 10000×0.1 + 500×5
  assert.equal(costMicrodollars(tokens, priceFor("claude-haiku-4-5", at)!), 7_000);
  // A typical triage: 2,500 in, 850 out ≈ 3.4 cents.
  assert.equal(costMicrodollars({ input: 2500, cacheWrite: 0, cacheRead: 0, output: 850 }, priceFor("claude-opus-5", at)!), 33_750);
});

test("dated model ids use their model's price", () => {
  assert.equal(modelFamily("claude-haiku-4-5-20251001"), "claude-haiku-4-5");
  const p = priceFor("claude-haiku-4-5-20251001", new Date());
  assert.ok(p);
  assert.equal(priceKey(p), "claude-haiku-4-5@2025-01-01");
});

test("a call uses the price in effect when it was made", () => {
  const prices: ModelPrice[] = [
    { model: "claude-test", effectiveFrom: "2026-01-01", input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 },
    { model: "claude-test", effectiveFrom: "2026-06-01", input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
  ];
  const before = priceFor("claude-test", new Date("2026-05-31T23:59:00Z"), prices)!;
  const after = priceFor("claude-test", new Date("2026-06-01T00:00:00Z"), prices)!;
  const older = priceFor("claude-test", new Date("2025-03-01T00:00:00Z"), prices)!;
  assert.equal(before.effectiveFrom, "2026-01-01");
  assert.equal(after.effectiveFrom, "2026-06-01");
  // Before the first entry: the first entry covers it.
  assert.equal(older.effectiveFrom, "2026-01-01");
  const t = { input: 100, cacheWrite: 0, cacheRead: 0, output: 100 };
  assert.equal(costMicrodollars(t, before), 600);
  assert.equal(costMicrodollars(t, after), 1200);
});

test("a model with no price has no price", () => {
  assert.equal(priceFor("claude-mystery-9", new Date()), null);
});

test("cost without caching prices every input token at the full rate", () => {
  const p = priceFor("claude-sonnet-5", new Date())!;
  // (1000 + 2000 + 10000) × 2 + 500 × 10
  assert.equal(uncachedCostMicrodollars(tokens, p), 31_000);
});

test("API usage is split the way it's billed", () => {
  assert.deepEqual(tokensFromApi({ input_tokens: 8, output_tokens: 638, cache_read_input_tokens: 10461, cache_creation_input_tokens: 4085 }), {
    input: 8,
    cacheWrite: 4085,
    cacheRead: 10461,
    output: 638,
  });
  assert.deepEqual(tokensFromApi({ input_tokens: 5, output_tokens: 6 }), { input: 5, cacheWrite: 0, cacheRead: 0, output: 6 });
});
