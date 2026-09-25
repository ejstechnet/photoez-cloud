import { SESSION_TYPES } from "./ai/triage";

// Session types shared by the studio profile, the public inquiry form, and
// AI triage (which classifies inquiries into these same types).
export { SESSION_TYPES };
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_LABELS: Record<SessionType, string> = {
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
  commercial: "Product & commercial",
  other: "Other",
};

// Types a photographer can list as offered ("other" is triage-only).
export const OFFERABLE_TYPES = [
  "portrait",
  "family",
  "maternity",
  "newborn",
  "senior",
  "headshot",
  "boudoir",
  "engagement",
  "elopement",
  "wedding",
  "event",
  "commercial",
] as const satisfies readonly Exclude<SessionType, "other">[];

export const SHOOT_LOCATIONS = ["studio", "outdoor", "on_location"] as const;
export type ShootLocation = (typeof SHOOT_LOCATIONS)[number];

export const LOCATION_LABELS: Record<ShootLocation, string> = {
  studio: "In the studio",
  outdoor: "Outdoors",
  on_location: "On location",
};
