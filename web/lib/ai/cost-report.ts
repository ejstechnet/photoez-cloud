import { and, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage, photographers, AI_FEATURES, type AiFeature } from "@/db/schema";
import { addDays, localDateOf, zonedToUtc } from "@/lib/booking/time";
import { PLAN_PRICES, type Plan } from "@/lib/plans";
import { MODEL_PRICES, modelFamily, priceKey, uncachedCostMicrodollars } from "./prices";

// The owner's AI cost report (/dashboard/ai-usage): a month of ai_usage rows
// turned into totals. summarizeUsage is pure (tested in cost-report.test.ts);
// costReport loads the month. Days and months are Pacific time, where the
// business is.

export const REPORT_TIME_ZONE = "America/Los_Angeles";
// One cent in microdollars.
const CENT = 10_000;

export type ReportRow = {
  photographerId: string | null;
  feature: AiFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputUncachedTokens: number | null;
  cacheWriteTokens: number | null;
  cacheReadTokens: number | null;
  tokenSplitKnown: boolean;
  costMicrodollars: number | null;
  priceKey: string | null;
  createdAt: Date;
};

export type ReportStudio = {
  id: string;
  name: string;
  plan: Plan;
  planInterval: string | null;
  subscriptionStatus: string | null;
};

export type StudioCost = {
  id: string;
  name: string;
  plan: Plan;
  // The plan's list price per month (yearly plans divided by 12), only while
  // a subscription is being paid; coupons, referral credit and extra storage
  // aren't included. 0 for Free, trials, and comped accounts.
  listPriceCents: number;
  microdollars: number;
  calls: number;
  // AI cost as a percentage of the list price; null when the studio pays nothing.
  percentOfPrice: number | null;
};

export type CostReport = {
  month: string;
  totalMicrodollars: number;
  calls: number;
  byFeature: { feature: AiFeature; microdollars: number; calls: number }[];
  byModel: { model: string; microdollars: number; calls: number }[];
  byDay: { day: string; microdollars: number }[];
  // Per triaged inquiry, Assistant question, and described photo (priced rows only).
  unitCosts: { feature: AiFeature; average: number; highest: number; count: number }[];
  studios: StudioCost[];
  // The Assistant's month with and without prompt caching (rows with a known split).
  cache: { actualMicrodollars: number; withoutCacheMicrodollars: number; savedMicrodollars: number };
  quality: { estimateRows: number; estimateMicrodollars: number; unpricedRows: number; unpricedTokens: number };
};

const PAYING = new Set(["active", "past_due"]);

export function listPriceCents(s: Pick<ReportStudio, "plan" | "planInterval" | "subscriptionStatus">): number {
  if (s.plan === "free" || !PAYING.has(s.subscriptionStatus ?? "")) return 0;
  const prices = PLAN_PRICES[s.plan];
  return s.planInterval === "year" ? Math.round(prices.year / 12) : prices.month;
}

// "2026-10" → its first and last day.
export function monthDays(month: string): { first: string; next: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { first: `${month}-01`, next };
}

export function summarizeUsage(month: string, rows: ReportRow[], studios: ReportStudio[], timeZone = REPORT_TIME_ZONE): CostReport {
  const cost = (r: ReportRow) => r.costMicrodollars ?? 0;
  const priced = rows.filter((r) => r.costMicrodollars !== null);
  const sumBy = <K extends string>(key: (r: ReportRow) => K) => {
    const out = new Map<K, { microdollars: number; calls: number }>();
    for (const r of rows) {
      const k = key(r);
      const v = out.get(k) ?? { microdollars: 0, calls: 0 };
      v.microdollars += cost(r);
      v.calls++;
      out.set(k, v);
    }
    return out;
  };

  const features = sumBy((r) => r.feature);
  const models = sumBy((r) => modelFamily(r.model));

  const { first, next } = monthDays(month);
  const days = new Map<string, number>();
  for (let d = first; d < next; d = addDays(d, 1)) days.set(d, 0);
  for (const r of rows) {
    const d = localDateOf(r.createdAt, timeZone);
    if (days.has(d)) days.set(d, days.get(d)! + cost(r));
  }

  const unitCosts = (["triage", "assistant", "photo_tag"] as const).map((feature) => {
    const costs = priced.filter((r) => r.feature === feature).map(cost);
    return {
      feature,
      average: costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : 0,
      highest: costs.length ? Math.max(...costs) : 0,
      count: costs.length,
    };
  });

  const byStudio = sumBy((r) => r.photographerId ?? "");
  const studioCosts: StudioCost[] = studios
    .filter((s) => byStudio.has(s.id))
    .map((s) => {
      const { microdollars, calls } = byStudio.get(s.id)!;
      const list = listPriceCents(s);
      return {
        id: s.id,
        name: s.name,
        plan: s.plan,
        listPriceCents: list,
        microdollars,
        calls,
        percentOfPrice: list > 0 ? Math.round((microdollars / (list * CENT)) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.microdollars - a.microdollars);

  let actual = 0;
  let withoutCache = 0;
  for (const r of rows) {
    if (r.feature !== "assistant" || !r.tokenSplitKnown || r.costMicrodollars === null) continue;
    const price = MODEL_PRICES.find((p) => priceKey(p) === r.priceKey);
    if (!price) continue;
    actual += r.costMicrodollars;
    withoutCache += uncachedCostMicrodollars(
      { input: r.inputUncachedTokens ?? 0, cacheWrite: r.cacheWriteTokens ?? 0, cacheRead: r.cacheReadTokens ?? 0, output: r.outputTokens },
      price,
    );
  }

  const estimates = rows.filter((r) => !r.tokenSplitKnown);
  const unpriced = rows.filter((r) => r.costMicrodollars === null);
  return {
    month,
    totalMicrodollars: rows.reduce((a, r) => a + cost(r), 0),
    calls: rows.length,
    byFeature: AI_FEATURES.map((feature) => ({ feature, ...(features.get(feature) ?? { microdollars: 0, calls: 0 }) })),
    byModel: [...models].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.microdollars - a.microdollars),
    byDay: [...days].map(([day, microdollars]) => ({ day, microdollars })),
    unitCosts,
    studios: studioCosts,
    cache: { actualMicrodollars: actual, withoutCacheMicrodollars: withoutCache, savedMicrodollars: withoutCache - actual },
    quality: {
      estimateRows: estimates.length,
      estimateMicrodollars: estimates.reduce((a, r) => a + cost(r), 0),
      unpricedRows: unpriced.length,
      unpricedTokens: unpriced.reduce((a, r) => a + r.inputTokens + r.outputTokens, 0),
    },
  };
}

// This month, Pacific time, as "YYYY-MM".
export const currentMonth = (now = new Date()) => localDateOf(now, REPORT_TIME_ZONE).slice(0, 7);

export async function costReport(month: string): Promise<CostReport> {
  const { first, next } = monthDays(month);
  const rows = await db
    .select({
      photographerId: aiUsage.photographerId,
      feature: aiUsage.feature,
      model: aiUsage.model,
      inputTokens: aiUsage.inputTokens,
      outputTokens: aiUsage.outputTokens,
      inputUncachedTokens: aiUsage.inputUncachedTokens,
      cacheWriteTokens: aiUsage.cacheWriteTokens,
      cacheReadTokens: aiUsage.cacheReadTokens,
      tokenSplitKnown: aiUsage.tokenSplitKnown,
      costMicrodollars: aiUsage.costMicrodollars,
      priceKey: aiUsage.priceKey,
      createdAt: aiUsage.createdAt,
    })
    .from(aiUsage)
    .where(and(gte(aiUsage.createdAt, zonedToUtc(first, "00:00", REPORT_TIME_ZONE)), lt(aiUsage.createdAt, zonedToUtc(next, "00:00", REPORT_TIME_ZONE))));
  const ids = [...new Set(rows.map((r) => r.photographerId).filter((id): id is string => Boolean(id)))];
  const studios = ids.length
    ? (
        await db
          .select({
            id: photographers.id,
            name: photographers.name,
            businessName: photographers.businessName,
            plan: photographers.plan,
            planInterval: photographers.planInterval,
            subscriptionStatus: photographers.subscriptionStatus,
          })
          .from(photographers)
          .where(inArray(photographers.id, ids))
      ).map((s) => ({ ...s, name: s.businessName || s.name }))
    : [];
  return summarizeUsage(month, rows, studios);
}

// Microdollars as dollars, e.g. "$0.0342" for small amounts, "$12.40" for large.
export function dollars(microdollars: number): string {
  const d = microdollars / 1_000_000;
  if (d !== 0 && Math.abs(d) < 1) return `$${d.toFixed(4)}`;
  return `$${d.toFixed(2)}`;
}
