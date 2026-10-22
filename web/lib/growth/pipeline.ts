// The Growth pipeline's rules: which moves need evidence, and how a score
// becomes a tier. No database here, so it's tested on its own
// (pipeline.test.ts).
import { GROWTH_STATUSES, type GrowthStatus, type GrowthTier } from "./constants";

export const STATUS_LABELS: Record<GrowthStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  approved: "Approved to reply",
  engaged: "Replied",
  responded: "They responded",
  demo_requested: "Demo requested",
  trial_started: "Trial started",
  paid_customer: "Paying customer",
  closed_lost: "Closed",
  not_qualified: "Not a fit",
};

// The spec: only record stages supported by real events. From "they
// responded" on, each move needs a line saying what happened.
export const NEEDS_EVIDENCE: readonly GrowthStatus[] = ["responded", "demo_requested", "trial_started", "paid_customer"];

// Finished posts, hidden from the queue unless asked for.
export const CLOSED_STATUSES: readonly GrowthStatus[] = ["closed_lost", "not_qualified"];

export const isGrowthStatus = (value: string): value is GrowthStatus => (GROWTH_STATUSES as readonly string[]).includes(value);

// Why a status change can't be saved, or null when it can.
export function statusChangeProblem(from: GrowthStatus, to: GrowthStatus, evidence: string | null): string | null {
  if (from === to) return `It's already "${STATUS_LABELS[to]}".`;
  if (NEEDS_EVIDENCE.includes(to) && !evidence?.trim()) {
    return `Say what happened (a quote or a link) before marking it "${STATUS_LABELS[to]}".`;
  }
  return null;
}

// The spec's tiers: 80–100 high priority, 50–79 worth a look, below 50 low.
export function tierFor(score: number | null): GrowthTier | null {
  if (score === null) return null;
  if (score >= 80) return "high";
  if (score >= 50) return "review";
  return "low";
}

// Elle's own score wins over the AI's when she's set one.
export const effectiveScore = (score: number | null, override: number | null) => override ?? score;
