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
} as const satisfies Record<string, readonly Plan[]>;

export type Feature = keyof typeof FEATURES;

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return (FEATURES[feature] as readonly Plan[]).includes(plan);
}

// The lowest plan that includes a feature, for "Upgrade to Pro" messages.
export function planFor(feature: Feature): Plan {
  return PLANS.find((plan) => hasFeature(plan, feature))!;
}
