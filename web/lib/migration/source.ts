import { and, asc, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  addons,
  clients,
  contractTemplates,
  favorites,
  galleries,
  migrationKeys,
  photographers,
  photos,
  sessionTypeAddons,
  sessionTypes,
} from "@/db/schema";
import { LOCATION_LABELS, type ShootLocation } from "@/lib/session-types";
import { photoKey, signedViewUrl } from "@/lib/storage";
import {
  MIGRATION_FORMAT,
  MIGRATION_VERSION,
  hashMigrationKey,
  isGalleryStatus,
  keyFromHeader,
  toPage,
  type MAddon,
  type MClient,
  type MContract,
  type MGallery,
  type MSessionType,
  type Manifest,
} from "./format";

// PhotoEZ Cloud as a migration *source* (docs/migration-format.md): the
// read-only data a studio's migration key opens up, for the PhotoEZ
// Migration plugin on WordPress to pull. Everything is scoped to the key's studio.

// The studio a request's key belongs to, or null (missing, wrong, expired, or revoked).
export async function studioForRequest(request: Request): Promise<string | null> {
  const key = keyFromHeader(request.headers.get("authorization"));
  if (!key) return null;
  const [row] = await db
    .select({ id: migrationKeys.id, photographerId: migrationKeys.photographerId, lastUsedAt: migrationKeys.lastUsedAt })
    .from(migrationKeys)
    .where(and(eq(migrationKeys.keyHash, hashMigrationKey(key)), isNull(migrationKeys.revokedAt), gt(migrationKeys.expiresAt, new Date())));
  if (!row) return null;
  // Noted at most once a minute, for "last used" in Settings.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(migrationKeys).set({ lastUsedAt: new Date() }).where(eq(migrationKeys.id, row.id));
  }
  return row.photographerId;
}

export async function manifest(photographerId: string): Promise<Manifest> {
  const [[studio], [c], [g], [p], [st], [ad], [ct]] = await Promise.all([
    db
      .select({ name: photographers.name, businessName: photographers.businessName, email: photographers.email, timeZone: photographers.timeZone })
      .from(photographers)
      .where(eq(photographers.id, photographerId)),
    db.select({ n: count() }).from(clients).where(eq(clients.photographerId, photographerId)),
    db.select({ n: count() }).from(galleries).where(eq(galleries.photographerId, photographerId)),
    db.select({ n: count() }).from(photos).innerJoin(galleries, eq(galleries.id, photos.galleryId)).where(eq(galleries.photographerId, photographerId)),
    db.select({ n: count() }).from(sessionTypes).where(eq(sessionTypes.photographerId, photographerId)),
    db.select({ n: count() }).from(addons).where(eq(addons.photographerId, photographerId)),
    db.select({ n: count() }).from(contractTemplates).where(eq(contractTemplates.photographerId, photographerId)),
  ]);
  return {
    format: MIGRATION_FORMAT,
    version: MIGRATION_VERSION,
    source: "cloud",
    studio: { name: studio.businessName || studio.name, email: studio.email, timeZone: studio.timeZone },
    counts: { clients: c.n, galleries: g.n, photos: p.n, sessionTypes: st.n, addons: ad.n, contracts: ct.n },
  };
}

export async function clientPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone, notes: clients.notes })
    .from(clients)
    .where(eq(clients.photographerId, photographerId))
    .orderBy(asc(clients.createdAt), asc(clients.id))
    .offset(offset)
    .limit(limit + 1);
  return toPage<MClient>(rows, offset, limit);
}

export async function addonPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select({ id: addons.id, name: addons.name, description: addons.description, priceCents: addons.priceCents, maxQuantity: addons.maxQuantity })
    .from(addons)
    .where(eq(addons.photographerId, photographerId))
    .orderBy(asc(addons.sortOrder), asc(addons.createdAt), asc(addons.id))
    .offset(offset)
    .limit(limit + 1);
  return toPage<MAddon>(rows, offset, limit);
}

export async function sessionTypePage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select()
    .from(sessionTypes)
    .where(eq(sessionTypes.photographerId, photographerId))
    .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt), asc(sessionTypes.id))
    .offset(offset)
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const links = page.length
    ? await db
        .select({ sessionTypeId: sessionTypeAddons.sessionTypeId, addonId: sessionTypeAddons.addonId, includedQuantity: sessionTypeAddons.includedQuantity })
        .from(sessionTypeAddons)
        .where(inArray(sessionTypeAddons.sessionTypeId, page.map((s) => s.id)))
    : [];
  const items: MSessionType[] = await Promise.all(
    page.map(async (s) => ({
      id: s.id,
      name: s.name,
      shortDescription: s.shortDescription,
      descriptionHtml: s.description,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      depositPercent: s.depositPercent,
      location: s.location ? (LOCATION_LABELS[s.location as ShootLocation] ?? s.location) : null,
      photosIncluded: s.photosIncluded,
      hidden: s.hidden,
      sortOrder: s.sortOrder,
      imageUrl: s.imageKey ? await signedViewUrl(s.imageKey) : null,
      addons: links.filter((l) => l.sessionTypeId === s.id).map((l) => ({ addonId: l.addonId, includedQuantity: l.includedQuantity })),
    })),
  );
  return { items, next: rows.length > limit ? offset + limit : null };
}

export async function contractPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select({ id: contractTemplates.id, title: contractTemplates.title, contentHtml: contractTemplates.content, isDefault: contractTemplates.isDefault })
    .from(contractTemplates)
    .where(eq(contractTemplates.photographerId, photographerId))
    .orderBy(asc(contractTemplates.createdAt), asc(contractTemplates.id))
    .offset(offset)
    .limit(limit + 1);
  return toPage<MContract>(rows, offset, limit);
}

export async function galleryPage(photographerId: string, offset: number, limit: number) {
  const rows = await db
    .select()
    .from(galleries)
    .where(eq(galleries.photographerId, photographerId))
    .orderBy(asc(galleries.createdAt), asc(galleries.id))
    .offset(offset)
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const photoRows = page.length
    ? await db
        .select({
          id: photos.id,
          galleryId: photos.galleryId,
          kind: photos.kind,
          name: photos.originalName,
          contentType: photos.contentType,
          width: photos.width,
          height: photos.height,
          sizeBytes: photos.sizeBytes,
          position: photos.position,
          favoriteId: favorites.id,
          note: favorites.note,
        })
        .from(photos)
        .leftJoin(favorites, eq(favorites.photoId, photos.id))
        .where(inArray(photos.galleryId, page.map((g) => g.id)))
        .orderBy(asc(photos.kind), asc(photos.position), asc(photos.createdAt))
    : [];
  const items: MGallery[] = page.map((g) => ({
    id: g.id,
    title: g.title,
    clientId: g.clientId,
    status: isGalleryStatus(g.status) ? g.status : "pending",
    freeLimit: g.freeLimit,
    extraPhotoPriceCents: g.extraPhotoPriceCents,
    notesEnabled: g.notesEnabled,
    createdAt: g.createdAt.toISOString(),
    deliveredAt: g.deliveredAt?.toISOString() ?? null,
    expiresAt: g.expiresAt?.toISOString() ?? null,
    coverPhotoId: null,
    photos: photoRows
      .filter((p) => p.galleryId === g.id)
      .map((p) => ({
        id: p.id,
        kind: p.kind === "final" ? "final" : "proof",
        name: p.name,
        contentType: p.contentType,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        position: p.position,
        selected: p.favoriteId !== null,
        note: p.note,
      })),
  }));
  return { items, next: rows.length > limit ? offset + limit : null };
}

// A link to download one photo's original, if it belongs to the key's studio.
export async function originalUrl(photographerId: string, photoId: string) {
  const [row] = await db
    .select({ fileKey: photos.fileKey })
    .from(photos)
    .innerJoin(galleries, eq(galleries.id, photos.galleryId))
    .where(and(eq(photos.id, photoId), eq(galleries.photographerId, photographerId)));
  return row ? signedViewUrl(photoKey(row.fileKey, "original")) : null;
}
