// Gallery stages, matching PhotoEZ for WordPress (_photoez_status).
export const GALLERY_STATUSES = [
  "pending",
  "submitted",
  "paid_and_submitted",
  "delivered",
  "completed",
  "expired",
] as const;

export type GalleryStatus = (typeof GALLERY_STATUSES)[number];

export const STATUS_LABELS: Record<GalleryStatus, string> = {
  pending: "Proofing",
  submitted: "Submitted",
  paid_and_submitted: "Paid & submitted",
  delivered: "Delivered",
  completed: "Completed",
  expired: "Expired",
};

// Where each status sits on the step pills: Proof gallery → Submitted →
// Awaiting finals → Final delivery.
export const STATUS_STEP: Record<GalleryStatus, number> = {
  pending: 0,
  submitted: 1,
  paid_and_submitted: 1,
  delivered: 3,
  completed: 3,
  expired: 3,
};
