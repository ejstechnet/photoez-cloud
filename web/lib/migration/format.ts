// The PhotoEZ Migration format (docs/migration-format.md): what moves between
// PhotoEZ Cloud and PhotoEZ for WordPress, and small helpers both the source
// API and the importer use. Pure, tested in format.test.ts.

import { createHash, randomBytes } from "node:crypto";

export const MIGRATION_FORMAT = "photoez-migration";
export const MIGRATION_VERSION = 1;
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
  counts: { clients: number; galleries: number; photos: number; sessionTypes: number; addons: number; contracts: number };
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

export type Page<T> = { items: T[]; next: number | null };

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
