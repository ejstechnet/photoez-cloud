// Shared bits for the AI traces pages.

export const OUTCOME_STYLES: Record<string, string> = {
  completed: "bg-lime/25 text-lime-ink",
  awaiting_approval: "bg-sun/30 text-brand-deep",
  error: "bg-coral/20 text-coral",
  running: "bg-border text-muted",
};

export const outcomeLabel = (outcome: string) => outcome.replace("_", " ");

export const seconds = (ms: number | null) => (ms == null ? "still running" : `${(ms / 1000).toFixed(1)}s`);
