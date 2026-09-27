import { cache } from "react";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers, reviews, studioFaqs, studioPhotos } from "@/db/schema";

// The studio page's sections, as menu links for the studio's other pages
// (booking, booking confirmation, gift cards): each jumps back to that part
// of the studio page. Only sections the studio actually has are listed.
export const studioLinks = cache(async (slug: string) => {
  const base = `/studio/${slug.toLowerCase()}`;
  const [studio] = await db
    .select({
      id: photographers.id,
      bio: photographers.studioBio,
      headshot: photographers.headshotKey,
      giftCards: photographers.giftCardsEnabled,
      stripeReady: photographers.stripeChargesEnabled,
    })
    .from(photographers)
    .where(eq(photographers.studioSlug, slug.toLowerCase()));
  if (!studio) return [];
  const [[work], [approved], [faq]] = await Promise.all([
    db.select({ n: count() }).from(studioPhotos).where(eq(studioPhotos.photographerId, studio.id)),
    db
      .select({ n: count() })
      .from(reviews)
      .where(and(eq(reviews.photographerId, studio.id), eq(reviews.status, "approved"))),
    db.select({ n: count() }).from(studioFaqs).where(eq(studioFaqs.photographerId, studio.id)),
  ]);
  return [
    (studio.bio || studio.headshot) && { href: `${base}#about`, label: "About" },
    approved.n > 0 && { href: `${base}#reviews`, label: "Reviews" },
    faq.n > 0 && { href: `${base}#faq`, label: "FAQ" },
    work.n > 0 && { href: `${base}#work`, label: "Work" },
    studio.giftCards && studio.stripeReady && { href: `${base}/gift-card`, label: "Gift cards" },
    { href: `${base}#contact`, label: "Contact" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));
});
