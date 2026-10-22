// AI scoring of saved posts, with stand-in models (no API calls, no cost).
// Runs against the in-memory Postgres (test/db.ts).   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, growthOpportunities, growthOutreach, growthSources } from "@/db/schema";
import { growthCapMicrodollars } from "./budget";
import { createOpportunity, ensureGrowthSeeded } from "./opportunities";
import { analyzeOpportunity, latestAnalyses, type AnalysisResult, type ModelCall, type PrefilterResult, type QualifyDeps } from "./qualify";

const NOW = new Date("2026-10-22T12:00:00Z");
const tokens = { input: 2000, cacheWrite: 0, cacheRead: 0, output: 600 };

function fake<T>(output: T, model: string, calls: { n: number }, seen?: string[]): ModelCall<T> {
  return async (_system, user) => {
    calls.n++;
    seen?.push(user);
    return { output, refused: false, model, tokens, latencyMs: 5 };
  };
}

const relevant: PrefilterResult = { relevant: true, segment: "portrait_senior", reason: "Asking which gallery app to use" };
const analysis: AnalysisResult = {
  summary: "A senior photographer wants to leave Pixieset.",
  statedProblem: "Fees and a separate contracts app",
  segment: "portrait_senior",
  criteria: {
    buying_intent: { points: 27, evidence: "Anyone moved off Pixieset?" },
    solvable_problem: { points: 22, evidence: "separate app for contracts" },
    fit: { points: 18, evidence: "Shooting mostly seniors" },
    engagement_path: { points: 10, evidence: "Any recommendations?" },
  },
  matchedFeatures: ["proofing", "contracts", "event_sales", "made_up_feature"],
  missingInfo: ["Budget"],
  nextStep: "Reply with how contracts and galleries work together.",
  confidence: 0.8,
  shouldReply: true,
  draftReply: "I switched my own studio to one app for this. PhotoEZ Cloud does contracts and proofing together: https://photoezcloud.com",
};

async function setup() {
  await ensureGrowthSeeded();
  const [group] = await db.select().from(growthSources).where(eq(growthSources.platform, "facebook"));
  const made = await createOpportunity({
    url: `https://www.facebook.com/groups/1/posts/${Math.random().toString().slice(2)}`,
    sourceId: group.id,
    title: null,
    excerpt: "Anyone moved off Pixieset? I still need a separate app for contracts. Shooting mostly seniors. Any recommendations?",
    authorLabel: null,
    publishedAt: new Date("2026-10-21T12:00:00Z"),
    kind: "sales_opportunity",
  });
  assert.ok("id" in made && !made.duplicate);
  return made.id;
}

test("the cap comes from .env, and unset means Growth AI is off", () => {
  assert.equal(growthCapMicrodollars(undefined), 0);
  assert.equal(growthCapMicrodollars("0"), 0);
  assert.equal(growthCapMicrodollars("abc"), 0);
  assert.equal(growthCapMicrodollars("15"), 15_000_000);
});

test("with Growth AI off, nothing is called and scoring by hand still works", async () => {
  process.env.GROWTH_AI_MONTHLY_CAP_USD = "";
  const id = await setup();
  const calls = { n: 0 };
  const out = await analyzeOpportunity(id, { prefilter: fake(relevant, "claude-haiku-5-5", calls), analyze: fake(analysis, "claude-opus-5-5", calls), now: NOW });
  assert.deepEqual(out, { status: "paused", why: "off" });
  assert.equal(calls.n, 0);
});

test("a post is checked, scored by code from quoted evidence, and gets a rule-following draft", async () => {
  process.env.GROWTH_AI_MONTHLY_CAP_USD = "15";
  const id = await setup();
  const pre = { n: 0 };
  const full = { n: 0 };
  const seen: string[] = [];
  const deps: QualifyDeps = { prefilter: fake(relevant, "claude-haiku-5-5", pre), analyze: fake(analysis, "claude-opus-5-5", full, seen), now: NOW };

  const out = await analyzeOpportunity(id, deps);
  // 27 + 22 + 18 + 10, plus 15 for a post from yesterday.
  assert.deepEqual(out, { status: "scored", total: 92, cached: false });
  const [post] = await db.select().from(growthOpportunities).where(eq(growthOpportunities.id, id));
  assert.equal(post.score, 92);
  assert.equal(post.tier, "high");
  // Scoring never moves a post along the pipeline.
  assert.equal(post.status, "new");

  // The prompt carried the group's rules and the features, with the post fenced off.
  assert.match(seen[0], /Links allowed: no/);
  assert.match(seen[0], /- contracts: /);
  assert.match(seen[0], /<post>\nAnyone moved off Pixieset\?/);

  const { full: saved } = await latestAnalyses(id);
  const result = saved?.result as { matchedFeatures: string[]; draftReply: string };
  // Only real, live features survive.
  assert.deepEqual(result.matchedFeatures, ["proofing", "contracts"]);
  // No link in a no-links group, and the disclosure is there.
  assert.ok(!/https?:|photoezcloud\.com/.test(result.draftReply), result.draftReply);
  assert.match(result.draftReply, /I make PhotoEZ Cloud, so I'm biased\.$/);

  const drafts = await db.select().from(growthOutreach).where(eq(growthOutreach.opportunityId, id));
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].state, "draft");

  // Both calls are costed as Growth, with no studio and no plan limit.
  const usage = await db.select().from(aiUsage).where(and(eq(aiUsage.feature, "growth_analysis"), eq(aiUsage.countsTowardLimit, false)));
  assert.ok(usage.length >= 1);
  assert.ok(usage.every((u) => u.photographerId === null && (u.costMicrodollars ?? 0) > 0));

  // Scoring again reuses the saved answers: no calls, no second draft.
  const again = await analyzeOpportunity(id, deps);
  assert.deepEqual(again, { status: "scored", total: 92, cached: true });
  assert.equal(pre.n, 1);
  assert.equal(full.n, 1);
  assert.equal((await db.select().from(growthOutreach).where(eq(growthOutreach.opportunityId, id))).length, 1);
});

test("a post the quick check rejects is never fully scored", async () => {
  process.env.GROWTH_AI_MONTHLY_CAP_USD = "15";
  const id = await setup();
  const full = { n: 0 };
  const out = await analyzeOpportunity(id, {
    prefilter: fake({ relevant: false, segment: "unclear", reason: "Asking about lenses" }, "claude-haiku-5-5", { n: 0 }),
    analyze: fake(analysis, "claude-opus-5-5", full),
    now: NOW,
  });
  assert.deepEqual(out, { status: "not_relevant", reason: "Asking about lenses" });
  assert.equal(full.n, 0);
  const [post] = await db.select().from(growthOpportunities).where(eq(growthOpportunities.id, id));
  assert.equal(post.score, 0);
  assert.equal(post.tier, "low");
});

test("over the monthly cap, scoring pauses", async () => {
  // A tiny cap that the earlier tests' spending already passed.
  process.env.GROWTH_AI_MONTHLY_CAP_USD = "0.000001";
  const id = await setup();
  const calls = { n: 0 };
  const out = await analyzeOpportunity(id, { prefilter: fake(relevant, "claude-haiku-5-5", calls), analyze: fake(analysis, "claude-opus-5-5", calls), now: new Date() });
  assert.deepEqual(out, { status: "paused", why: "cap" });
  assert.equal(calls.n, 0);
  process.env.GROWTH_AI_MONTHLY_CAP_USD = "";
});
