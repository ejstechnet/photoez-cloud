"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";

// Screening reviews (PhotoEZ Reviews' approve / reject / unpublish). Each one
// checks who is logged in and only touches that photographer's reviews.

type Screen = "approve" | "hide" | "unpublish";

export async function screenReview(reviewId: string, action: Screen): Promise<void> {
  const photographer = await requirePhotographer();
  if (!z.uuid().safeParse(reviewId).success) return;
  const set =
    action === "approve"
      ? { status: "approved" as const, approvedAt: new Date() }
      : action === "hide"
        ? { status: "rejected" as const, approvedAt: null }
        : { status: "submitted" as const, approvedAt: null };
  await db
    .update(reviews)
    .set(set)
    // Only reviews the client actually sent can be screened.
    .where(and(eq(reviews.id, reviewId), eq(reviews.photographerId, photographer.id)));
  revalidatePath("/dashboard/reviews");
  revalidatePath("/studio/[slug]", "page");
}

export async function deleteReview(reviewId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (!z.uuid().safeParse(reviewId).success) return;
  await db.delete(reviews).where(and(eq(reviews.id, reviewId), eq(reviews.photographerId, photographer.id)));
  revalidatePath("/dashboard/reviews");
  revalidatePath("/studio/[slug]", "page");
}
