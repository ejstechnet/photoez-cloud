import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, galleries, invoices, photographers, reviews } from "@/db/schema";
import { cleanDesign } from "@/lib/design";

// A studio's Page Designer choices, found from whatever a public page has:
// its studio slug, a gallery link, a booking link, a review link, or an invoice link.

export const designForSlug = cache(async (slug: string) => {
  const [row] = await db
    .select({ design: photographers.design })
    .from(photographers)
    .where(eq(photographers.studioSlug, slug.toLowerCase()));
  return cleanDesign(row?.design);
});

export const designForGalleryToken = cache(async (token: string) => {
  const [row] = await db
    .select({ design: photographers.design })
    .from(galleries)
    .innerJoin(photographers, eq(photographers.id, galleries.photographerId))
    .where(eq(galleries.shareToken, token));
  return cleanDesign(row?.design);
});

export const designForBookingToken = cache(async (token: string) => {
  const [row] = await db
    .select({ design: photographers.design })
    .from(bookings)
    .innerJoin(photographers, eq(photographers.id, bookings.photographerId))
    .where(eq(bookings.manageToken, token));
  return cleanDesign(row?.design);
});

export const designForReviewToken = cache(async (token: string) => {
  const [row] = await db
    .select({ design: photographers.design })
    .from(reviews)
    .innerJoin(photographers, eq(photographers.id, reviews.photographerId))
    .where(eq(reviews.token, token));
  return cleanDesign(row?.design);
});

export const designForInvoiceToken = cache(async (token: string) => {
  const [row] = await db
    .select({ design: photographers.design })
    .from(invoices)
    .innerJoin(photographers, eq(photographers.id, invoices.photographerId))
    .where(eq(invoices.token, token));
  return cleanDesign(row?.design);
});
