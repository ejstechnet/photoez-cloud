import { count } from "drizzle-orm";
import { db } from "@/db";
import { growthFeatures, growthKeywords, growthSources } from "@/db/schema";
import { SEED_FEATURES, SEED_KEYWORDS, SEED_SOURCES, SEED_VERIFIED_AT } from "./seed-data";

// Puts GrowthPilot's starting features, search phrases and sources in place
// the first time the Growth section is used. Safe to run again: rows that
// already exist (by key, phrase or name) are left as Elle edited them, so it
// never undoes a change. Returns how many rows each table gained.
export async function seedGrowth() {
  const features = await db
    .insert(growthFeatures)
    .values(
      SEED_FEATURES.map((f, i) => ({
        ...f,
        plans: f.plans ?? "All",
        verifiedAt: SEED_VERIFIED_AT,
        sortOrder: i,
      })),
    )
    .onConflictDoNothing({ target: growthFeatures.key })
    .returning({ id: growthFeatures.id });
  const keywords = await db
    .insert(growthKeywords)
    .values(SEED_KEYWORDS)
    .onConflictDoNothing({ target: growthKeywords.phrase })
    .returning({ id: growthKeywords.id });
  const sources = await db
    .insert(growthSources)
    .values(SEED_SOURCES.map((s) => ({ ...s, rulesCheckedAt: SEED_VERIFIED_AT })))
    .onConflictDoNothing({ target: growthSources.name })
    .returning({ id: growthSources.id });
  return { features: features.length, keywords: keywords.length, sources: sources.length };
}

// True once the starting data is in, so pages can skip seeding cheaply.
export async function growthSeeded() {
  const [row] = await db.select({ n: count() }).from(growthFeatures);
  return (row?.n ?? 0) > 0;
}
