import { and, gte, inArray, sum } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";

// Growth's own monthly AI budget, separate from studios' AI. The cap is
// GROWTH_AI_MONTHLY_CAP_USD in .env (decided with Elle 2026-10-21: $15).
// Unset or 0 means Growth AI is off and posts are scored by hand. Every
// Growth AI call checks this first. Tested in qualify.test.ts.

const GROWTH_FEATURES = ["growth_prefilter", "growth_analysis"] as const;

export function growthCapMicrodollars(env = process.env.GROWTH_AI_MONTHLY_CAP_USD): number {
  const dollars = Number(env ?? 0);
  return Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 1_000_000) : 0;
}

// The first moment of this calendar month (UTC).
export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function growthSpendThisMonth(now = new Date()): Promise<number> {
  const [row] = await db
    .select({ total: sum(aiUsage.costMicrodollars) })
    .from(aiUsage)
    .where(and(inArray(aiUsage.feature, [...GROWTH_FEATURES]), gte(aiUsage.createdAt, monthStart(now))));
  return Number(row?.total ?? 0);
}

// What the Growth pages show, and what every AI call checks.
export async function growthBudget(now = new Date()) {
  const cap = growthCapMicrodollars();
  const spent = await growthSpendThisMonth(now);
  return { cap, spent, on: cap > 0, canSpend: cap > 0 && spent < cap };
}
