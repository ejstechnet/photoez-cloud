// The PhotoEZ Migration format (docs/migration-format.md): what moves between
// PhotoEZ Cloud and PhotoEZ for WordPress, and small helpers both the source
// API and the importer use. Pure, tested in format.test.ts.

import { createHash, randomBytes } from "node:crypto";

export const MIGRATION_FORMAT = "photoez-migration";
// 2 added bookings (with signed contracts and inspiration photos), session
// credits, reviews, and quotes/invoices. Version 1 sources simply don't offer them.
export const MIGRATION_VERSION = 2;
export const KEY_PREFIX = "pezm_";
export const KEY_DAYS = 7;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export const GALLERY_STATUSES = ["pending", "submitted", "paid_and_submitted", "delivered", "completed", "expired"] as const;
export type MigrationGalleryStatus = (typeof GALLERY_STATUSES)[number];

export type Manifest = {
  format: typeof MIGRATION_FORMAT;
  version: number;
  source: "cloud" | "wordpress";
  studio: { name: string; email: string | null; timeZone: string | null };
  counts: {
    clients: number;
    galleries: number;
    photos: number;
    sessionTypes: number;
    addons: number;
    contracts: number;
    // Version 2.
    bookings?: number;
    credits?: number;
    reviews?: number;
    invoices?: number;
  };
};

export type MClient = { id: string; name: string; email: string | null; phone: string | null; notes: string | null };
export type MAddon = { id: string; name: string; description: string | null; priceCents: number; maxQuantity: number };
export type MSessionType = {
  id: string;
  name: string;
  shortDescription: string | null;
  descriptionHtml: string | null;
  durationMinutes: number;
  priceCents: number;
  depositPercent: number;
  location: string | null;
  photosIncluded: number | null;
  hidden: boolean;
  sortOrder: number;
  imageUrl: string | null;
  addons: { addonId: string; includedQuantity: number }[];
};
export type MContract = { id: string; title: string; contentHtml: string; isDefault: boolean };
export type MPhoto = {
  id: string;
  kind: "proof" | "final";
  name: string;
  contentType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  position: number;
  selected: boolean;
  note: string | null;
};
export type MGallery = {
  id: string;
  title: string;
  clientId: string | null;
  status: MigrationGalleryStatus;
  freeLimit: number;
  extraPhotoPriceCents: number | null;
  notesEnabled: boolean | null;
  createdAt: string;
  deliveredAt: string | null;
  expiresAt: string | null;
  coverPhotoId: string | null;
  photos: MPhoto[];
};

// ---- Version 2 ----

// A client's signature on a contract, exactly as signed.
export type MSignature = {
  title: string | null;
  contentHtml: string;
  signerName: string;
  signatureType: "draw" | "type";
  // A PNG data URL for a drawn signature; the typed name for a typed one.
  signatureData: string;
  signedAt: string;
  clientIp: string | null;
};

export const BOOKING_STATES = ["confirmed", "completed", "cancelled"] as const;
export type MBookingStatus = (typeof BOOKING_STATES)[number];

export type MBooking = {
  id: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  sessionTypeId: string | null;
  sessionName: string;
  // The client's own name for the shoot ("Tina's Senior Photos").
  title: string | null;
  startsAt: string;
  endsAt: string;
  status: MBookingStatus;
  // The whole booking with extras, less any discount.
  totalCents: number;
  addonsCents: number;
  depositPercent: number;
  // Money the client has paid, and session credit put toward it (counts as paid).
  paidCents: number;
  creditCents: number;
  addons: { addonId: string | null; name: string; priceCents: number; quantity: number; includedQuantity: number }[];
  // Answers to the studio's own booking questions.
  answers: { label: string; value: string }[];
  notes: string | null;
  galleryId: string | null;
  createdAt: string;
  cancelledAt: string | null;
  signedContract: MSignature | null;
  // Download each with GET /photos/{id}/original.
  inspoPhotos: { id: string; name: string; contentType: string }[];
};

export type MCredit = {
  id: string;
  clientEmail: string;
  clientName: string;
  amountCents: number;
  usedCents: number;
  reason: string;
  sourceBookingId: string | null;
  expiresOn: string | null;
  createdAt: string;
};

export const REVIEW_STATES = ["requested", "submitted", "approved", "rejected"] as const;
export type MReview = {
  id: string;
  galleryId: string | null;
  clientName: string;
  clientEmail: string;
  status: (typeof REVIEW_STATES)[number];
  displayName: string | null;
  rating: number | null;
  body: string | null;
  // A photo from the gallery (a gallery photo's id), shown only with consent.
  photoId: string | null;
  photoConsent: boolean;
  requestedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
};

export const INVOICE_STATES = ["draft", "sent", "approved", "declined", "partial", "paid", "cancelled"] as const;
export type MInvoice = {
  id: string;
  kind: "quote" | "invoice";
  number: string;
  status: (typeof INVOICE_STATES)[number];
  clientId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  title: string;
  eventDate: string | null;
  dueDate: string | null;
  items: { description: string; quantity: number; unitCents: number }[];
  taxBps: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  // 0 or 100 = paid in full at once.
  depositPercent: number;
  paidCents: number;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  signedContract: MSignature | null;
};

export type Page<T> = { items: T[]; next: number | null };

// What a studio chose to bring over. galleryIds lists the chosen galleries;
// clientIds the clients those galleries need (brought over even when
// "clients" is off, so every gallery keeps its client). The version 2
// parts are optional so imports started before them still read.
export type ImportChoice = {
  clients: boolean;
  sessions: boolean;
  contracts: boolean;
  galleryIds: string[];
  clientIds: string[];
  bookings?: boolean;
  credits?: boolean;
  reviews?: boolean;
  invoices?: boolean;
};

// Totals for the progress bar, counting only what was chosen.
export function chosenTotals(
  counts: Manifest["counts"],
  choice: ImportChoice,
  galleries: { id: string; photos: number }[],
): Record<string, number> {
  const chosen = new Set(choice.galleryIds);
  const picked = galleries.filter((g) => chosen.has(g.id));
  return {
    clients: choice.clients ? counts.clients : choice.clientIds.length,
    addons: choice.sessions ? counts.addons : 0,
    sessionTypes: choice.sessions ? counts.sessionTypes : 0,
    contracts: choice.contracts ? counts.contracts : 0,
    galleries: picked.length,
    photos: picked.reduce((sum, g) => sum + g.photos, 0),
    bookings: choice.bookings ? (counts.bookings ?? 0) : 0,
    credits: choice.credits ? (counts.credits ?? 0) : 0,
    reviews: choice.reviews ? (counts.reviews ?? 0) : 0,
    invoices: choice.invoices ? (counts.invoices ?? 0) : 0,
  };
}

// A new key: shown to the studio once. Only its hash is stored.
export function newMigrationKey() {
  return `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function hashMigrationKey(key: string) {
  return createHash("sha256").update(key.trim()).digest("hex");
}

// The key from "Authorization: Bearer pezm_…", or null.
export function keyFromHeader(header: string | null) {
  const match = /^Bearer\s+(pezm_[A-Za-z0-9_-]{20,80})\s*$/.exec(header ?? "");
  return match ? match[1] : null;
}

// offset / limit from the query string, kept in range.
export function pageParams(searchParams: URLSearchParams) {
  const offset = Math.max(0, Math.floor(Number(searchParams.get("offset") ?? 0)) || 0);
  const asked = Math.floor(Number(searchParams.get("limit") ?? DEFAULT_LIMIT)) || DEFAULT_LIMIT;
  return { offset, limit: Math.min(MAX_LIMIT, Math.max(1, asked)) };
}

// A page of results, given one extra row was fetched to see if more follow.
export function toPage<T>(rows: T[], offset: number, limit: number): Page<T> {
  return { items: rows.slice(0, limit), next: rows.length > limit ? offset + limit : null };
}

export function isGalleryStatus(value: string): value is MigrationGalleryStatus {
  return (GALLERY_STATUSES as readonly string[]).includes(value);
}
