import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, inquiries } from "@/db/schema";
import { costMicrodollars, priceFor, priceKey } from "./prices";

// Fills in the AI cost report for usage from before costs were recorded
// (scripts/backfill-ai-usage.ts). Safe to run again: it only touches rows
// without a cost and inquiries without a triage row.
//
// - Old ai_usage rows added cached and uncached input together, so their
//   cost is an upper-bound estimate (every input token at the full price);
//   token_split_known stays false and the report labels them.
// - Triaged inquiries kept their tokens on the inquiry only: each gets one
//   triage row (an estimate the same way), never counted toward a plan.
//   An inquiry triaged more than once only kept its last run's tokens.
export async function backfillAiUsage(): Promise<{ priced: number; unpriced: number; inquiries: number }> {
  let priced = 0;
  let unpriced = 0;

  const old = await db
    .select({ id: aiUsage.id, model: aiUsage.model, input: aiUsage.inputTokens, output: aiUsage.outputTokens, at: aiUsage.createdAt })
    .from(aiUsage)
    .where(and(eq(aiUsage.tokenSplitKnown, false), isNull(aiUsage.costMicrodollars)));
  for (const row of old) {
    const price = priceFor(row.model, row.at);
    if (!price) {
      unpriced++;
      continue;
    }
    await db
      .update(aiUsage)
      .set({ costMicrodollars: costMicrodollars({ input: row.input, cacheWrite: 0, cacheRead: 0, output: row.output }, price), priceKey: priceKey(price) })
      .where(and(eq(aiUsage.id, row.id), isNull(aiUsage.costMicrodollars)));
    priced++;
  }

  const triaged = await db
    .select({
      id: inquiries.id,
      photographerId: inquiries.photographerId,
      model: inquiries.model,
      input: inquiries.inputTokens,
      output: inquiries.outputTokens,
      at: inquiries.triagedAt,
    })
    .from(inquiries)
    .where(
      and(
        isNotNull(inquiries.triagedAt),
        isNotNull(inquiries.model),
        sql`not exists (select 1 from ${aiUsage} where ${aiUsage.inquiryId} = ${inquiries.id} and ${aiUsage.feature} = 'triage')`,
      ),
    );
  for (const q of triaged) {
    const at = q.at!;
    const tokens = { input: q.input ?? 0, cacheWrite: 0, cacheRead: 0, output: q.output ?? 0 };
    const price = priceFor(q.model!, at);
    await db.insert(aiUsage).values({
      photographerId: q.photographerId,
      feature: "triage",
      model: q.model!,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      tokenSplitKnown: false,
      costMicrodollars: price ? costMicrodollars(tokens, price) : null,
      priceKey: price ? priceKey(price) : null,
      countsTowardLimit: false,
      inquiryId: q.id,
      createdAt: at,
    });
  }
  return { priced, unpriced, inquiries: triaged.length };
}
