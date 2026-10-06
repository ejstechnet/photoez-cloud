import { db } from "@/db";
import { aiUsage, type AiFeature } from "@/db/schema";
import { costMicrodollars, priceFor, priceKey, type TokenCounts } from "./prices";

// Records one AI call (or one Assistant question) in ai_usage with its
// tokens and cost. Every feature calls this after the API answers; the AI
// cost report (/dashboard/ai-usage) reads the rows. It never throws: a
// failed write is logged and the feature carries on.

export type UsageRecord = {
  feature: AiFeature;
  // null for eval runs.
  photographerId: string | null;
  model: string;
  tokens: TokenCounts;
  latencyMs?: number | null;
  // Assistant questions and described photos count against plan limits;
  // triage and evals never do.
  countsTowardLimit: boolean;
  inquiryId?: string | null;
  traceId?: string | null;
  galleryId?: string | null;
  at?: Date;
};

export async function recordAiUsage(r: UsageRecord): Promise<void> {
  try {
    const at = r.at ?? new Date();
    const price = priceFor(r.model, at);
    if (!price) console.warn(`No price for model ${r.model}; its cost is left empty.`);
    await db.insert(aiUsage).values({
      photographerId: r.photographerId,
      feature: r.feature,
      model: r.model,
      inputTokens: r.tokens.input + r.tokens.cacheWrite + r.tokens.cacheRead,
      outputTokens: r.tokens.output,
      inputUncachedTokens: r.tokens.input,
      cacheWriteTokens: r.tokens.cacheWrite,
      cacheReadTokens: r.tokens.cacheRead,
      tokenSplitKnown: true,
      costMicrodollars: price ? costMicrodollars(r.tokens, price) : null,
      priceKey: price ? priceKey(price) : null,
      latencyMs: r.latencyMs ?? null,
      countsTowardLimit: r.countsTowardLimit,
      inquiryId: r.inquiryId ?? null,
      traceId: r.traceId ?? null,
      galleryId: r.galleryId ?? null,
      createdAt: at,
    });
  } catch (error) {
    console.error("Couldn't record AI usage", r.feature, error);
  }
}
