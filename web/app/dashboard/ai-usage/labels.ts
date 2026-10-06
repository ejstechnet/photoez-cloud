import type { AiFeature } from "@/db/schema";
import type { StudioCost } from "@/lib/ai/cost-report";

export const FEATURE_LABELS: Record<AiFeature, string> = {
  triage: "Inquiry triage",
  assistant: "Studio Assistant",
  photo_tag: "Photo tagging",
  eval: "Evals",
};

// What one unit of each feature is.
export const UNIT_LABELS: Partial<Record<AiFeature, string>> = {
  triage: "per triaged inquiry",
  assistant: "per Assistant question",
  photo_tag: "per photo described",
};

export const SORTS = ["cost", "percent", "name"] as const;
export type StudioSort = (typeof SORTS)[number];

// The per-studio table's order: most expensive first by default.
export function sortStudios(studios: StudioCost[], sort: StudioSort): StudioCost[] {
  const list = [...studios];
  if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "percent") return list.sort((a, b) => (b.percentOfPrice ?? -1) - (a.percentOfPrice ?? -1));
  return list.sort((a, b) => b.microdollars - a.microdollars);
}
