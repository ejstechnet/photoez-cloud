"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { favorites, galleries, photos } from "@/db/schema";
import { findGalleryByToken, isOverLimit } from "@/lib/client-gallery";

// Actions a client can take from their gallery link. The token is re-checked
// on every call, and changes are only allowed while the gallery is in proofing.

type Result = { ok: true; selected: boolean; count: number } | { error: string };

async function selectionCount(galleryId: string) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(favorites)
    .innerJoin(photos, eq(photos.id, favorites.photoId))
    .where(eq(photos.galleryId, galleryId));
  return total;
}

export async function toggleFavorite(token: string, photoId: string): Promise<Result> {
  const gallery = await findGalleryByToken(token);
  if (!gallery) return { error: "This gallery link isn't valid." };
  if (gallery.status !== "pending") return { error: "Your selections have already been submitted." };
  if (!z.uuid().safeParse(photoId).success) return { error: "That photo couldn't be found." };

  const [photo] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.galleryId, gallery.id)));
  if (!photo) return { error: "That photo couldn't be found." };

  const removed = await db.delete(favorites).where(eq(favorites.photoId, photo.id)).returning({ id: favorites.id });
  if (removed.length > 0) {
    return { ok: true, selected: false, count: await selectionCount(gallery.id) };
  }

  if (isOverLimit(await selectionCount(gallery.id), gallery.freeLimit)) {
    return { error: `You can choose up to ${gallery.freeLimit} photos. Unselect one to pick another.` };
  }
  await db.insert(favorites).values({ photoId: photo.id }).onConflictDoNothing();
  return { ok: true, selected: true, count: await selectionCount(gallery.id) };
}

export async function submitSelections(token: string): Promise<{ ok: true } | { error: string }> {
  const gallery = await findGalleryByToken(token);
  if (!gallery) return { error: "This gallery link isn't valid." };
  if (gallery.status !== "pending") return { error: "Your selections have already been submitted." };
  if ((await selectionCount(gallery.id)) === 0) return { error: "Choose at least one photo first." };

  // Only move forward if the gallery is still in proofing (guards a double submit).
  await db
    .update(galleries)
    .set({ status: "submitted", submittedAt: new Date() })
    .where(and(eq(galleries.id, gallery.id), eq(galleries.status, "pending")));

  revalidatePath(`/g/${token}`);
  revalidatePath(`/dashboard/galleries/${gallery.id}`);
  return { ok: true };
}
