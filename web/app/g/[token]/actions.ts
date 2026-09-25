"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { favorites, galleries, photos } from "@/db/schema";
import { findGalleryByToken, isOverLimit } from "@/lib/client-gallery";
import { extrasFor } from "@/lib/gallery-extras";
import { paymentAccount } from "@/lib/payments/checkout";
import { paidGalleryExtras, startGalleryCheckout } from "@/lib/payments/gallery-checkout";

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

  if (isOverLimit(await selectionCount(gallery.id), gallery.freeLimit, gallery.extraPriceCents)) {
    return { error: `You can choose up to ${gallery.freeLimit} photos. Unselect one to pick another.` };
  }
  await db.insert(favorites).values({ photoId: photo.id }).onConflictDoNothing();
  return { ok: true, selected: true, count: await selectionCount(gallery.id) };
}

export async function submitSelections(
  token: string,
): Promise<{ ok: true } | { checkoutUrl: string } | { error: string }> {
  const gallery = await findGalleryByToken(token);
  if (!gallery) return { error: "This gallery link isn't valid." };
  if (gallery.status !== "pending") return { error: "Your selections have already been submitted." };
  const selected = await selectionCount(gallery.id);
  if (selected === 0) return { error: "Choose at least one photo first." };

  // Extra photos past the included number: paid through Stripe when the
  // photographer has it connected, otherwise recorded as owed.
  const extras = extrasFor(selected, gallery.freeLimit, gallery.extraPriceCents);
  const alreadyPaid = await paidGalleryExtras(gallery.id);
  const toPay = Math.max(0, extras.count - alreadyPaid.count);
  if (toPay > 0 && gallery.extraPriceCents !== null) {
    const account = await paymentAccount(gallery.photographerId);
    if (account) {
      try {
        const checkoutUrl = await startGalleryCheckout({
          galleryId: gallery.id,
          token,
          title: gallery.title,
          studioName: gallery.studioName ?? gallery.photographerName,
          account,
          count: toPay,
          priceCents: gallery.extraPriceCents,
        });
        if (checkoutUrl) return { checkoutUrl };
      } catch (error) {
        console.error("Stripe Checkout failed", error);
      }
      return { error: "Online payment isn't available right now. Please try again in a minute." };
    }
  }

  // Only move forward if the gallery is still in proofing (guards a double submit).
  await db
    .update(galleries)
    .set({
      // Every extra already paid for (after proofing was reopened): paid & submitted.
      status: extras.count > 0 && toPay === 0 ? "paid_and_submitted" : "submitted",
      submittedAt: new Date(),
      extrasCount: extras.count,
      extrasCents: alreadyPaid.cents + toPay * (gallery.extraPriceCents ?? 0),
    })
    .where(and(eq(galleries.id, gallery.id), eq(galleries.status, "pending")));

  revalidatePath(`/g/${token}`);
  revalidatePath(`/dashboard/galleries/${gallery.id}`);
  return { ok: true };
}
