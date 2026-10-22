// GrowthPilot's fixed lists: the values its database columns allow and the
// lead-scoring criteria. GrowthPilot is the owner-only Growth section that
// finds photographers asking about studio software (plan in the separate
// Desktop/growthpilot folder). Kept free of database imports so
// db/schema.ts can use them.

// How true a PhotoEZ Cloud feature is today. Drafts may mention "live" ones,
// and "partial" ones only with their reply note.
export const GROWTH_FEATURE_STATUSES = ["live", "partial", "coming", "not_offered"] as const;
export const GROWTH_FEATURE_AREAS = ["studio", "galleries", "selling"] as const;

// Where a post was found, and how it got in.
export const GROWTH_PLATFORMS = ["facebook", "reddit", "forum", "web", "other"] as const;
export const GROWTH_SOURCE_KINDS = ["manual", "rss", "search_api", "reddit_api"] as const;

// Search phrase groups from the spec. "negative" phrases make the first AI
// check skip a post (camera advice, not business software).
export const GROWTH_KEYWORD_GROUPS = ["alternatives", "proofing_galleries", "business_management", "buying_intent", "negative"] as const;

// A person who could be helped now, or something only worth reading.
export const GROWTH_KINDS = ["sales_opportunity", "market_research"] as const;

// The pipeline. Stages after "engaged" need evidence; the AI never sets any.
export const GROWTH_STATUSES = [
  "new",
  "reviewed",
  "approved",
  "engaged",
  "responded",
  "demo_requested",
  "trial_started",
  "paid_customer",
  "closed_lost",
  "not_qualified",
] as const;
export type GrowthStatus = (typeof GROWTH_STATUSES)[number];

export const GROWTH_TIERS = ["high", "review", "low"] as const;
export type GrowthTier = (typeof GROWTH_TIERS)[number];

export const GROWTH_ANALYSIS_STAGES = ["prefilter", "full"] as const;
export const GROWTH_OUTREACH_STATES = ["draft", "approved", "rejected", "posted"] as const;

// The spec's scoring: the AI gives each criterion points with a quote from the
// post as evidence; code adds them up (no quote = 0).
export const GROWTH_CRITERIA = [
  { key: "buying_intent", label: "Explicit software buying intent", max: 30 },
  { key: "solvable_problem", label: "Problem PhotoEZ Cloud can solve", max: 25 },
  { key: "fit", label: "Suitable photography business", max: 20 },
  { key: "recency", label: "Recency", max: 15 },
  { key: "engagement_path", label: "Permitted path to engagement", max: 10 },
] as const;
export type GrowthCriterionKey = (typeof GROWTH_CRITERIA)[number]["key"];
export type GrowthCriterionScore = { points: number; max: number; evidence: string };
export type GrowthCriteria = Record<GrowthCriterionKey, GrowthCriterionScore>;

// Every reply says who's writing it, unless a source sets its own wording.
export const DEFAULT_DISCLOSURE = "I make PhotoEZ Cloud, so I'm biased.";
