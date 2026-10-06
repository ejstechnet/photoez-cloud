// The owner's AI cost report: totals by feature, model, day and studio from a
// fixed set of usage rows, and who may see it.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { isOwnerEmail } from "@/lib/signup-stats";
import { makeStudio } from "../../test/assistant-fixtures.ts";
import { sortStudios } from "../../app/dashboard/ai-usage/labels.ts";
import { costReport, dollars, listPriceCents, summarizeUsage, type ReportRow, type ReportStudio } from "./cost-report";

const studios: ReportStudio[] = [
  { id: "a", name: "Alpha Photo", plan: "pro", planInterval: "month", subscriptionStatus: "active" },
  { id: "b", name: "Bravo Studio", plan: "studio", planInterval: "year", subscriptionStatus: "active" },
  { id: "c", name: "Charlie Free", plan: "free", planInterval: null, subscriptionStatus: null },
];

function row(over: Partial<ReportRow>): ReportRow {
  return {
    photographerId: "a",
    feature: "assistant",
    model: "claude-sonnet-5",
    inputTokens: 0,
    outputTokens: 0,
    inputUncachedTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    tokenSplitKnown: true,
    costMicrodollars: 0,
    priceKey: "claude-sonnet-5@2025-01-01",
    createdAt: new Date("2026-10-05T18:00:00Z"),
    ...over,
  };
}

const rows: ReportRow[] = [
  // Alpha: two Assistant questions with caching (Sonnet 5).
  row({ inputUncachedTokens: 100, cacheWriteTokens: 0, cacheReadTokens: 10_000, outputTokens: 500, inputTokens: 10_100, costMicrodollars: 7_200 }),
  row({ inputUncachedTokens: 100, cacheWriteTokens: 4_000, cacheReadTokens: 0, outputTokens: 500, inputTokens: 4_100, costMicrodollars: 15_200, createdAt: new Date("2026-10-06T18:00:00Z") }),
  // Alpha: a triage (Opus 5).
  row({ feature: "triage", model: "claude-opus-5", priceKey: "claude-opus-5@2025-01-01", inputUncachedTokens: 2000, inputTokens: 2000, outputTokens: 800, costMicrodollars: 30_000 }),
  // Bravo: three described photos (dated Haiku id).
  ...[1250, 1250, 1500].map((c) =>
    row({ photographerId: "b", feature: "photo_tag", model: "claude-haiku-4-5-20251001", priceKey: "claude-haiku-4-5@2025-01-01", costMicrodollars: c, inputTokens: 790, inputUncachedTokens: 790, outputTokens: 91 }),
  ),
  // Charlie: an old estimate row, and one with no price.
  row({ photographerId: "c", tokenSplitKnown: false, inputUncachedTokens: null, cacheWriteTokens: null, cacheReadTokens: null, inputTokens: 5000, outputTokens: 100, costMicrodollars: 11_000 }),
  row({ photographerId: "c", model: "claude-mystery-9", priceKey: null, costMicrodollars: null, inputTokens: 300, outputTokens: 40 }),
  // An eval run: no studio. 11pm Pacific on Oct 31 is still October.
  row({ photographerId: null, feature: "eval", model: "claude-opus-5", priceKey: "claude-opus-5@2025-01-01", costMicrodollars: 40_000, createdAt: new Date("2026-11-01T06:00:00Z") }),
];

test("totals by feature, model, day and studio", () => {
  const r = summarizeUsage("2026-10", rows, studios);
  assert.equal(r.calls, 9);
  assert.equal(r.totalMicrodollars, 7_200 + 15_200 + 30_000 + 4_000 + 11_000 + 40_000);
  assert.deepEqual(
    r.byFeature.map((f) => [f.feature, f.microdollars, f.calls]),
    [
      ["triage", 30_000, 1],
      ["assistant", 7_200 + 15_200 + 11_000, 4],
      ["photo_tag", 4_000, 3],
      ["eval", 40_000, 1],
    ],
  );
  // Dated ids are grouped with their model.
  assert.deepEqual(
    r.byModel.map((m) => [m.model, m.microdollars, m.calls]),
    [
      ["claude-opus-5", 70_000, 2],
      ["claude-sonnet-5", 33_400, 3],
      ["claude-haiku-4-5", 4_000, 3],
      ["claude-mystery-9", 0, 1],
    ],
  );
  // Every day of October, in Pacific time.
  assert.equal(r.byDay.length, 31);
  const day = (d: string) => r.byDay.find((x) => x.day === d)!.microdollars;
  assert.equal(day("2026-10-05"), 7_200 + 30_000 + 4_000 + 11_000);
  assert.equal(day("2026-10-06"), 15_200);
  assert.equal(day("2026-10-31"), 40_000);
});

test("unit costs per inquiry, question and photo", () => {
  const r = summarizeUsage("2026-10", rows, studios);
  const unit = (f: string) => r.unitCosts.find((u) => u.feature === f)!;
  assert.deepEqual(unit("triage"), { feature: "triage", average: 30_000, highest: 30_000, count: 1 });
  // The unpriced question isn't averaged in.
  assert.deepEqual(unit("assistant"), { feature: "assistant", average: 11_133, highest: 15_200, count: 3 });
  assert.deepEqual(unit("photo_tag"), { feature: "photo_tag", average: 1_333, highest: 1_500, count: 3 });
});

test("per studio: spend, list price and AI as a share of it, most expensive first", () => {
  const r = summarizeUsage("2026-10", rows, studios);
  assert.deepEqual(
    r.studios.map((s) => [s.name, s.microdollars, s.listPriceCents, s.percentOfPrice]),
    [
      // $0.0524 of $29 ≈ 0.2%
      ["Alpha Photo", 52_400, 2900, 0.2],
      ["Charlie Free", 11_000, 0, null],
      // Yearly Studio: $490 / 12
      ["Bravo Studio", 4_000, 4083, 0],
    ],
  );
  assert.deepEqual(
    sortStudios(r.studios, "name").map((s) => s.name),
    ["Alpha Photo", "Bravo Studio", "Charlie Free"],
  );
});

test("list price only while a subscription is being paid", () => {
  assert.equal(listPriceCents({ plan: "pro", planInterval: "month", subscriptionStatus: "active" }), 2900);
  assert.equal(listPriceCents({ plan: "studio", planInterval: "year", subscriptionStatus: "past_due" }), 4083);
  assert.equal(listPriceCents({ plan: "studio", planInterval: null, subscriptionStatus: null }), 0, "comped");
  assert.equal(listPriceCents({ plan: "pro", planInterval: "month", subscriptionStatus: "canceled" }), 0);
  assert.equal(listPriceCents({ plan: "free", planInterval: null, subscriptionStatus: null }), 0);
});

test("Assistant cache savings and data-quality notes", () => {
  const r = summarizeUsage("2026-10", rows, studios);
  // Without caching: (100 + 10000) × 2 + 500 × 10 = 25,200 and (100 + 4000) × 2 + 500 × 10 = 13,200.
  assert.deepEqual(r.cache, { actualMicrodollars: 22_400, withoutCacheMicrodollars: 38_400, savedMicrodollars: 16_000 });
  assert.deepEqual(r.quality, { estimateRows: 1, estimateMicrodollars: 11_000, unpricedRows: 1, unpricedTokens: 340 });
});

test("the report loads one Pacific-time month from the database", async () => {
  const s = await makeStudio("Month Test Studio");
  const at = (iso: string) => new Date(iso);
  const add = (createdAt: Date, cost: number) =>
    db.insert(aiUsage).values({
      photographerId: s.studio.id,
      feature: "assistant",
      model: "claude-sonnet-5",
      tokenSplitKnown: true,
      costMicrodollars: cost,
      priceKey: "claude-sonnet-5@2025-01-01",
      createdAt,
    });
  await add(at("2030-03-01T07:59:00Z"), 1); // Feb 28, 11:59pm Pacific: February
  await add(at("2030-03-01T08:00:00Z"), 10); // Mar 1, midnight Pacific
  await add(at("2030-04-01T06:59:00Z"), 100); // Mar 31, 11:59pm Pacific (daylight time)
  await add(at("2030-04-01T07:00:00Z"), 1000); // Apr 1
  const march = await costReport("2030-03");
  assert.equal(march.totalMicrodollars, 110);
  assert.deepEqual(
    march.studios.map((x) => [x.name, x.microdollars]),
    [["Month Test Studio", 110]],
  );
});

test("money reads plainly", () => {
  assert.equal(dollars(34_200), "$0.0342");
  assert.equal(dollars(12_400_000), "$12.40");
  assert.equal(dollars(0), "$0.00");
});

test("only the owner's email gets the report and its spreadsheet", () => {
  const was = process.env.OWNER_EMAILS;
  process.env.OWNER_EMAILS = "owner@example.test, second@example.test";
  try {
    assert.equal(isOwnerEmail("Owner@Example.test"), true);
    assert.equal(isOwnerEmail("second@example.test"), true);
    assert.equal(isOwnerEmail("studio@example.test"), false);
    assert.equal(isOwnerEmail(null), false);
    process.env.OWNER_EMAILS = "";
    assert.equal(isOwnerEmail("owner@example.test"), false, "no owners configured: nobody");
  } finally {
    process.env.OWNER_EMAILS = was;
  }
});
