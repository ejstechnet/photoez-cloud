// Photographer subscription tiers and what each one unlocks. Billing for the
// plans (Stripe Billing) comes later; for now the plan is an account setting.
// Tested in plans.test.ts.

export const PLANS = ["free", "pro", "studio"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = { free: "Free", pro: "Pro", studio: "Studio" };

// Each feature lists the plans that include it.
const FEATURES = {
  // Clients can pick more photos than their package includes, for a price.
  galleryUpsells: ["pro", "studio"],
  // AI gallery search (photos described by Claude) and the Studio Assistant.
  aiSearch: ["pro", "studio"],
} as const satisfies Record<string, readonly Plan[]>;

export type Feature = keyof typeof FEATURES;

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return (FEATURES[feature] as readonly Plan[]).includes(plan);
}

// The lowest plan that includes a feature, for "Upgrade to Pro" messages.
export function planFor(feature: Feature): Plan {
  return PLANS.find((plan) => hasFeature(plan, feature))!;
}

// Photos a studio can have described for gallery search each month.
// Measured 2026-09-27: ~790 input + ~91 output tokens per photo with Claude
// Haiku 4.5, about $0.00125 a photo ($12.50 for a full Studio month).
export const AI_PHOTO_ALLOWANCE: Record<Plan, number> = { free: 0, pro: 3000, studio: 10000 };

// Studio Assistant questions a studio can ask each month (Claude Sonnet 5,
// roughly 1–3 cents a question).
export const AI_ASSISTANT_ALLOWANCE: Record<Plan, number> = { free: 0, pro: 300, studio: 1000 };
