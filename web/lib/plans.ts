// Photographer subscription tiers: what each costs, includes, and allows.
// Paid plans are Stripe subscriptions on the PhotoEZ Cloud account
// (lib/billing.ts); new sign-ups get a 14-day Pro trial with no card.
// Decided with Elle 2026-09-27. Tested in plans.test.ts.

export const PLANS = ["free", "pro", "studio"] as const;
export type Plan = (typeof PLANS)[number];

export const PLAN_LABELS: Record<Plan, string> = { free: "Free", pro: "Pro", studio: "Studio" };

// Each feature lists the plans that include it.
const FEATURES = {
  // Clients can pick more photos than their package includes, for a price.
  galleryUpsells: ["pro", "studio"],
  // AI gallery search (photos described by Claude) and the Studio Assistant.
  aiSearch: ["pro", "studio"],
  // Hiding "Powered by PhotoEZ Cloud" on the studio's pages.
  removeBranding: ["studio"],
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

// ---- Prices, limits, and the trial ----

export const PAID_PLANS = ["pro", "studio"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];
export const INTERVALS = ["month", "year"] as const;
export type Interval = (typeof INTERVALS)[number];

// In cents. Yearly is two months free.
export const PLAN_PRICES: Record<PaidPlan, Record<Interval, number>> = {
  pro: { month: 1900, year: 19000 },
  studio: { month: 3900, year: 39000 },
};

// Stripe finds each price by this key (lib/billing.ts), so price ids never
// need to be copied into settings.
export const priceLookupKey = (plan: PaidPlan, interval: Interval) => `photoez_${plan}_${interval}`;

export function planFromLookupKey(key: string | null | undefined): { plan: PaidPlan; interval: Interval } | null {
  const match = /^photoez_(pro|studio)_(month|year)$/.exec(key ?? "");
  return match ? { plan: match[1] as PaidPlan, interval: match[2] as Interval } : null;
}

const GB = 1024 ** 3;
// Storage counts the photos' original files. Galleries count while they're
// active (not completed or expired). null = no limit.
export const PLAN_LIMITS: Record<Plan, { storageBytes: number; activeGalleries: number | null }> = {
  free: { storageBytes: 3 * GB, activeGalleries: 3 },
  pro: { storageBytes: 150 * GB, activeGalleries: null },
  studio: { storageBytes: 1024 * GB, activeGalleries: null },
};

export const TRIAL_DAYS = 14;

// The plan a studio gets right now: during the free trial, a Free studio
// has Pro.
export function effectivePlan(plan: Plan, trialEndsAt: Date | null, now = new Date()): Plan {
  return plan === "free" && trialEndsAt && trialEndsAt > now ? "pro" : plan;
}

export function trialDaysLeft(trialEndsAt: Date | null, now = new Date()) {
  if (!trialEndsAt || trialEndsAt <= now) return 0;
  return Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

// "1.2 GB of 3 GB"
export function formatStorage(bytes: number) {
  if (bytes >= GB) return `${Math.round((bytes / GB) * 10) / 10} GB`;
  return `${Math.max(0, Math.round(bytes / 1024 ** 2))} MB`;
}

// ---- Photographer referrals (lib/referrals.ts) ----

// The new studio's discount on its first plan payment (a Stripe coupon made
// by scripts/stripe-billing-setup.mjs).
export const REFERRAL_DISCOUNT_PERCENT = 20;
export const REFERRAL_COUPON_ID = "photoez_referral_20";
// Most paid-off referrals that earn credit in any 12 months.
export const REFERRAL_YEARLY_CAP = 12;

// The referrer's reward: one month of their own plan, or of Pro while
// they're on Free (so the credit is there when they upgrade).
export function referralRewardCents(referrerPlan: Plan) {
  return PLAN_PRICES[referrerPlan === "studio" ? "studio" : "pro"].month;
}
