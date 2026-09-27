"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { photographers, photos, reviews } from "@/db/schema";
import { afterResponse } from "@/lib/email/send";
import { emailReviewSubmitted } from "@/lib/review-requests";
import { checkReview, offerGoogle } from "@/lib/reviews";

// Saves a client's review from their private link. The token is the only key,
// so everything is checked again here.
export async function submitReview(
  token: string,
  input: { rating: number; body: string; displayName: string; photoId: string | null; photoConsent: boolean },
): Promise<{ ok: true; googleUrl: string | null } | { error: string }> {
  if (typeof token !== "string" || token.length < 10) return { error: "This review link isn't valid." };
  const [row] = await db
    .select({ review: reviews, googleUrl: photographers.googleReviewUrl })
    .from(reviews)
    .innerJoin(photographers, eq(photographers.id, reviews.photographerId))
    .where(eq(reviews.token, token));
  if (!row) return { error: "This review link isn't valid." };
  if (row.review.status !== "requested") return { error: "You've already sent your review. Thank you!" };

  const checked = checkReview({
    rating: Number(input.rating),
    body: String(input.body ?? ""),
    displayName: String(input.displayName ?? ""),
    photoId: input.photoId ? String(input.photoId) : null,
    photoConsent: Boolean(input.photoConsent),
  });
  if ("error" in checked) return checked;
  const review = checked.review;

  // The photo must be one of the final photos in their own gallery.
  if (review.photoId) {
    const [photo] =
      row.review.galleryId && /^[0-9a-f-]{36}$/i.test(review.photoId)
        ? await db
            .select({ id: photos.id })
            .from(photos)
            .where(and(eq(photos.id, review.photoId), eq(photos.galleryId, row.review.galleryId), eq(photos.kind, "final")))
        : [];
    if (!photo) return { error: "That photo couldn't be found. Please choose another." };
  }

  const saved = await db
    .update(reviews)
    .set({
      status: "submitted",
      rating: review.rating,
      body: review.body,
      displayName: review.displayName,
      photoId: review.photoId,
      photoConsent: review.photoConsent,
      submittedAt: new Date(),
    })
    // Only once, even if the form is sent twice.
    .where(and(eq(reviews.id, row.review.id), eq(reviews.status, "requested")))
    .returning({ id: reviews.id });
  if (saved.length === 0) return { error: "You've already sent your review. Thank you!" };

  afterResponse(() => emailReviewSubmitted(row.review.id));
  revalidatePath("/dashboard/reviews");
  return { ok: true, googleUrl: offerGoogle(review.rating, row.googleUrl) ? row.googleUrl : null };
}
