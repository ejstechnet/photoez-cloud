"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { favorites, galleries, photos } from "@/db/schema";
import { findGalleryByToken, isOverLimit } from "@/lib/client-gallery";
import { hasFeature } from "@/lib/plans";
import { searchGalleryPhotos } from "@/lib/photo-search";
import { extrasFor } from "@/lib/gallery-extras";
import { paymentAccount } from "@/lib/payments/checkout";
import { paidGalleryExtras, startGalleryCheckout } from "@/lib/payments/gallery-checkout";
import { emailSelectionsSubmitted } from "@/lib/email/notify";
import { afterResponse } from "@/lib/email/send";
import { quoteStoreShipping, startStoreCheckout } from "@/lib/store/checkout";
import { finishDesign, startDesign } from "@/lib/store/designs";
import { startFieldUpload } from "@/lib/store/field-uploads";

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
  const submitted = await db
    .update(galleries)
    .set({
      // Every extra already paid for (after proofing was reopened): paid & submitted.
      status: extras.count > 0 && toPay === 0 ? "paid_and_submitted" : "submitted",
      submittedAt: new Date(),
      extrasCount: extras.count,
      extrasCents: alreadyPaid.cents + toPay * (gallery.extraPriceCents ?? 0),
    })
    .where(and(eq(galleries.id, gallery.id), eq(galleries.status, "pending")))
    .returning({ id: galleries.id });
  if (submitted.length > 0) afterResponse(() => emailSelectionsSubmitted(gallery.id));

  revalidatePath(`/g/${token}`);
  revalidatePath(`/dashboard/galleries/${gallery.id}`);
  return { ok: true };
}

// A client's note on one of their picks (e.g. an editing request). Only while
// proofing, only on photos they've picked, plain text up to 500 characters.
export async function saveNote(
  token: string,
  photoId: string,
  note: string,
): Promise<{ ok: true; note: string } | { error: string }> {
  const gallery = await findGalleryByToken(token);
  if (!gallery) return { error: "This gallery link isn't valid." };
  if (!gallery.notesEnabled) return { error: "Notes are turned off for this gallery." };
  if (gallery.status !== "pending") return { error: "Your selections have already been submitted." };
  if (!z.uuid().safeParse(photoId).success) return { error: "That photo couldn't be found." };

  const clean = note.replace(/\s+$/g, "").slice(0, 500).trim();
  const updated = await db
    .update(favorites)
    .set({ note: clean || null })
    .where(
      and(
        eq(favorites.photoId, photoId),
        sql`${favorites.photoId} in (select id from photos where gallery_id = ${gallery.id})`,
      ),
    )
    .returning({ id: favorites.id });
  if (updated.length === 0) return { error: "Pick the photo first, then add a note." };
  revalidatePath(`/dashboard/galleries/${gallery.id}`);
  return { ok: true, note: clean };
}

// The client's gallery search: photo ids matching what they typed. Only on
// plans with gallery search, and only the photos they're currently choosing
// from (proofs) or downloading (finals).
export async function searchGallery(token: string, query: string): Promise<string[]> {
  const gallery = await findGalleryByToken(token);
  if (!gallery || !hasFeature(gallery.plan, "aiSearch")) return [];
  const delivered = gallery.status === "delivered" || gallery.status === "completed";
  return searchGalleryPhotos(gallery.id, query, [delivered ? "final" : "proof"]);
}

// The gallery shop's checkout: the cart is checked and priced on the server,
// then the client goes to Stripe to pay the studio (lib/store/checkout.ts).
export async function checkoutStoreCart(
  token: string,
  cart: unknown,
  // SwaggPress items: the shipping option chosen from quoteCartShipping.
  shipping: { quoteId: string; rateId: string } | null = null,
): Promise<{ url: string } | { error: string }> {
  const gallery = await findGalleryByToken(token);
  if (!gallery || (gallery.status !== "delivered" && gallery.status !== "completed")) {
    return { error: "This gallery's shop isn't open." };
  }
  return startStoreCheckout({
    shipping: shipping && typeof shipping.quoteId === "string" && typeof shipping.rateId === "string" ? shipping : null,
    galleryId: gallery.id,
    token,
    photographerId: gallery.photographerId,
    studioName: gallery.studioName ?? gallery.photographerName,
    clientName: gallery.clientName,
    clientEmail: gallery.clientEmail ?? null,
    cart,
  });
}

// Shipping options for the cart's SwaggPress items to the client's address.
export async function quoteCartShipping(token: string, cart: unknown, shipTo: unknown) {
  const gallery = await findGalleryByToken(token);
  if (!gallery || (gallery.status !== "delivered" && gallery.status !== "completed")) {
    return { error: "This gallery's shop isn't open." };
  }
  return quoteStoreShipping({ galleryId: gallery.id, photographerId: gallery.photographerId, cart, shipTo });
}

async function shopGallery(token: string) {
  const gallery = await findGalleryByToken(token);
  return gallery && (gallery.status === "delivered" || gallery.status === "completed") ? gallery : null;
}

// The gallery designer, step 1: where to upload the design's pictures.
export async function startGalleryDesign(token: string, productId: string, hasBack: boolean) {
  const gallery = await shopGallery(token);
  if (!gallery) return { error: "This gallery's shop isn't open." };
  if (!z.uuid().safeParse(productId).success) return { error: "That product isn't available." };
  return startDesign({ galleryId: gallery.id, photographerId: gallery.photographerId, productId, hasBack: hasBack === true });
}

// Step 2: the pictures are uploaded; save the design for the cart.
export async function finishGalleryDesign(token: string, input: { designId: string; productId: string; design: unknown; photoIds: unknown }) {
  const gallery = await shopGallery(token);
  if (!gallery) return { error: "This gallery's shop isn't open." };
  if (!z.uuid().safeParse(input?.designId).success || !z.uuid().safeParse(input?.productId).success) {
    return { error: "The design couldn't be saved. Please try again." };
  }
  const photoIds = Array.isArray(input.photoIds) ? input.photoIds.filter((id): id is string => typeof id === "string") : [];
  return finishDesign({
    galleryId: gallery.id,
    photographerId: gallery.photographerId,
    designId: input.designId,
    productId: input.productId,
    design: input.design,
    photoIds,
  });
}

// A photo field's upload (e.g. a school logo): where to send the file.
export async function startShopUpload(token: string, contentType: string, size: number) {
  const gallery = await shopGallery(token);
  if (!gallery) return { error: "This gallery's shop isn't open." };
  return startFieldUpload({
    photographerId: gallery.photographerId,
    galleryId: gallery.id,
    contentType: String(contentType),
    size: Number(size),
  });
}

