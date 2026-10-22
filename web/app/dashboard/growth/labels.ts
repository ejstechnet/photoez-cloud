import type { GrowthStatus, GrowthTier } from "@/lib/growth/constants";

// Badge colors and words for the Growth pages.

export const STATUS_STYLES: Record<GrowthStatus, string> = {
  new: "bg-sky/15 text-sky",
  reviewed: "bg-border text-muted",
  approved: "bg-violet/20 text-violet",
  engaged: "bg-violet/20 text-violet",
  responded: "bg-lime/25 text-lime-ink",
  demo_requested: "bg-lime/25 text-lime-ink",
  trial_started: "bg-lime/25 text-lime-ink",
  paid_customer: "bg-coral/20 text-coral",
  closed_lost: "bg-border text-muted",
  not_qualified: "bg-border text-muted",
};

export const TIER_LABELS: Record<GrowthTier, string> = { high: "High priority", review: "Worth a look", low: "Low priority" };

export const TIER_STYLES: Record<GrowthTier, string> = {
  high: "bg-lime text-brand-deep",
  review: "bg-sun/40 text-brand-deep",
  low: "bg-border text-muted",
};

export const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  reddit: "Reddit",
  forum: "Forum",
  web: "Web",
  other: "Other",
};

export const KIND_LABELS = { sales_opportunity: "Someone to help", market_research: "Just research" } as const;

export const badge = "rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase";
