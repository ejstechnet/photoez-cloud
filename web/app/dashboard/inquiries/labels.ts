import type { TriageResult } from "@/lib/ai/triage";

export const SESSION_LABELS: Record<TriageResult["sessionType"], string> = {
  wedding: "Wedding",
  elopement: "Elopement",
  engagement: "Engagement",
  portrait: "Portrait",
  family: "Family",
  maternity: "Maternity",
  newborn: "Newborn",
  senior: "Senior",
  headshot: "Headshot",
  boudoir: "Boudoir",
  event: "Event",
  commercial: "Commercial",
  other: "Other",
};

export const STATUS_STYLES = {
  new: { label: "New", className: "bg-coral text-brand-deep" },
  replied: { label: "Replied", className: "bg-sky-light text-brand-deep" },
  converted: { label: "Client", className: "bg-lime text-brand-deep" },
  archived: { label: "Archived", className: "bg-border text-muted" },
} as const;

export const URGENCY_STYLES = {
  high: "bg-danger/15 text-danger",
  normal: "bg-sun/25 text-foreground",
  low: "bg-border text-muted",
} as const;

export function formatBudget(t: TriageResult) {
  const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;
  if (t.budgetMin !== null && t.budgetMax !== null && t.budgetMin !== t.budgetMax) {
    return `${dollars(t.budgetMin)}–${dollars(t.budgetMax)}`;
  }
  const single = t.budgetMax ?? t.budgetMin;
  return single !== null ? dollars(single) : t.budgetText;
}

export function formatEventDate(t: TriageResult) {
  if (t.eventDate) {
    const date = new Date(`${t.eventDate}T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
    }
  }
  return t.dateText;
}
