// GrowthPilot's tables and starting data (step 1.1). Runs against the
// in-memory Postgres built from the real migrations (test/db.ts).   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, growthAnalyses, growthFeatures, growthOpportunities, growthSources, growthStatusEvents } from "@/db/schema";
import { GROWTH_CRITERIA } from "./constants";
import { SEED_FEATURES, SEED_KEYWORDS } from "./seed-data";
import { growthSeeded, seedGrowth } from "./seed";

test("the scoring criteria add up to 100, as in the spec", () => {
  assert.equal(
    GROWTH_CRITERIA.reduce((sum, c) => sum + c.max, 0),
    100,
  );
});

test("starting data has no repeated keys or phrases", () => {
  assert.equal(new Set(SEED_FEATURES.map((f) => f.key)).size, SEED_FEATURES.length);
  assert.equal(new Set(SEED_KEYWORDS.map((k) => k.phrase.toLowerCase())).size, SEED_KEYWORDS.length);
  // A feature that isn't fully live always says why, so a draft can't skip it.
  for (const f of SEED_FEATURES.filter((f) => f.status === "partial")) assert.ok(f.replyNote, f.key);
});

test("seeding fills the tables once and never undoes Elle's edits", async () => {
  assert.equal(await growthSeeded(), false);
  const first = await seedGrowth();
  assert.deepEqual(first, { features: SEED_FEATURES.length, keywords: SEED_KEYWORDS.length, sources: 2 });
  assert.equal(await growthSeeded(), true);

  // Elle marks the store fully live and renames her group…
  await db.update(growthFeatures).set({ status: "live" }).where(eq(growthFeatures.key, "online_store"));
  await db.update(growthSources).set({ name: "Photo Biz Owners" }).where(eq(growthSources.name, "My main photography Facebook group"));

  // …and a second run adds only what's missing (the renamed group's old name).
  const again = await seedGrowth();
  assert.deepEqual(again, { features: 0, keywords: 0, sources: 1 });
  const [store] = await db.select().from(growthFeatures).where(eq(growthFeatures.key, "online_store"));
  assert.equal(store.status, "live");

  const [group] = await db.select().from(growthSources).where(eq(growthSources.name, "Photo Biz Owners"));
  assert.equal(group.linksAllowed, false);
  assert.equal(group.disclosure, "I make PhotoEZ Cloud, so I'm biased.");
});

test("a post is saved once per canonical URL, and deleting it removes its history", async () => {
  const url = "https://www.facebook.com/groups/1/posts/2";
  const [post] = await db
    .insert(growthOpportunities)
    .values({ url: `${url}?ref=share`, canonicalUrl: url, platform: "facebook", excerpt: "Anyone moved off Pixieset?" })
    .returning();
  assert.equal(post.status, "new");
  await assert.rejects(db.insert(growthOpportunities).values({ url, canonicalUrl: url, platform: "facebook" }));

  // Growth AI usage belongs to no studio and never counts against a plan.
  const [usage] = await db
    .insert(aiUsage)
    .values({ photographerId: null, feature: "growth_analysis", model: "claude-opus-5-5", countsTowardLimit: false })
    .returning();
  await db.insert(growthAnalyses).values({
    opportunityId: post.id,
    stage: "full",
    model: "claude-opus-5-5",
    promptVersion: "test",
    inputHash: "hash-1",
    result: {},
    total: 72,
    aiUsageId: usage.id,
  });
  await db.insert(growthStatusEvents).values({ opportunityId: post.id, fromStatus: "new", toStatus: "reviewed" });

  await db.delete(growthOpportunities).where(eq(growthOpportunities.id, post.id));
  const [left] = await db.select({ n: count() }).from(growthAnalyses).where(eq(growthAnalyses.opportunityId, post.id));
  assert.equal(left.n, 0);
  // The cost record stays: it's spending, not personal data.
  const [kept] = await db.select({ n: count() }).from(aiUsage).where(eq(aiUsage.id, usage.id));
  assert.equal(kept.n, 1);
});
