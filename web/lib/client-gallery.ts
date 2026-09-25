import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, favorites, galleries, photographers, photos } from "@/db/schema";
import { extraPhotoPrice } from "@/lib/gallery-extras";
import { hasFeature } from "@/lib/plans";

// The client side of a gallery, reached only through its private share link.
// There's no login: the unguessable token *is* the key, so every lookup starts
// here and nothing is ever looked up by gallery id from the client.

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24}$/;

export async function findGalleryByToken(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      status: galleries.status,
      freeLimit: galleries.freeLimit,
      shareToken: galleries.shareToken,
      headerImageKey: galleries.headerImageKey,
      photographerId: galleries.photographerId,
      galleryExtraPrice: galleries.extraPhotoPriceCents,
      studioExtraPrice: photographers.extraPhotoPriceCents,
      plan: photographers.plan,
      extrasCount: galleries.extrasCount,
      extrasCents: galleries.extrasCents,
      clientName: clients.name,
      studioName: photographers.businessName,
      photographerName: photographers.name,
      studioSlug: photographers.studioSlug,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
      // Only watermarked proofs are shown when the photographer has a watermark.
      hasWatermark: sql<boolean>`${photographers.watermarkKey} is not null`,
    })
    .from(galleries)
    .innerJoin(photographers, eq(photographers.id, galleries.photographerId))
    .leftJoin(clients, eq(clients.id, galleries.clientId))
    .where(eq(galleries.shareToken, token));
  if (!gallery) return null;
  // What each photo past the included number costs, or null when the client
  // is simply capped (the photographer's plan decides; see lib/plans.ts).
  const extraPriceCents = extraPhotoPrice({
    planAllows: hasFeature(gallery.plan, "galleryUpsells"),
    freeLimit: gallery.freeLimit,
    galleryPriceCents: gallery.galleryExtraPrice,
    studioPriceCents: gallery.studioExtraPrice,
  });
  return { ...gallery, extraPriceCents };
}

export type ClientGallery = NonNullable<Awaited<ReturnType<typeof findGalleryByToken>>>;

// Photos the client may see, in order, with whether each is a favorite.
// With a watermark, a photo whose proof hasn't been made yet stays hidden
// rather than falling back to a clean version.
export async function clientPhotos(gallery: ClientGallery) {
  const rows = await db
    .select({
      id: photos.id,
      fileKey: photos.fileKey,
      width: photos.width,
      height: photos.height,
      proofMadeAt: photos.proofMadeAt,
      favoriteId: favorites.id,
    })
    .from(photos)
    .leftJoin(favorites, eq(favorites.photoId, photos.id))
    .where(
      and(
        eq(photos.galleryId, gallery.id),
        eq(photos.kind, "proof"),
        gallery.hasWatermark ? isNotNull(photos.proofMadeAt) : undefined,
      ),
    )
    .orderBy(asc(photos.position));

  return rows.map((row) => ({
    id: row.id,
    fileKey: row.fileKey,
    aspect: row.width && row.height ? row.width / row.height : 2 / 3,
    variant: gallery.hasWatermark ? ("proof" as const) : ("preview" as const),
    selected: row.favoriteId !== null,
  }));
}

// The delivered finals, in order. Only available once the gallery is delivered.
export async function clientFinals(gallery: ClientGallery) {
  if (!isDelivered(gallery)) return [];
  const rows = await db
    .select({
      id: photos.id,
      fileKey: photos.fileKey,
      originalName: photos.originalName,
      sizeBytes: photos.sizeBytes,
      width: photos.width,
      height: photos.height,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .where(and(eq(photos.galleryId, gallery.id), eq(photos.kind, "final")))
    .orderBy(asc(photos.position));
  return rows.map((row) => ({ ...row, aspect: row.width && row.height ? row.width / row.height : 2 / 3 }));
}

export const isDelivered = (gallery: ClientGallery) => gallery.status === "delivered" || gallery.status === "completed";

// "0" free picks means no limit.
// Whether one more pick goes past the included number when extras can't be bought.
export const isOverLimit = (count: number, freeLimit: number, extraPriceCents: number | null = null) =>
  extraPriceCents === null && freeLimit > 0 && count >= freeLimit;
