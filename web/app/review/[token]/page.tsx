import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { galleries, photographers, photos, reviews } from "@/db/schema";
import { StudioFooter } from "@/app/studio/[slug]/studio-bar";
import { StudioNav } from "@/app/studio/[slug]/studio-nav";
import { defaultDisplayName, offerGoogle } from "@/lib/reviews";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = {
  title: "Leave a review",
  // Private link: never in search engines.
  robots: { index: false, follow: false },
};

const MAX_PHOTO_CHOICES = 60;

// The review form a client reaches from their review request email. No
// login: the token in the link is the key.
export default async function ReviewPage({ params }: PageProps<"/review/[token]">) {
  const { token } = await params;
  const [row] = await db
    .select({ review: reviews, studio: photographers, galleryTitle: galleries.title })
    .from(reviews)
    .innerJoin(photographers, eq(photographers.id, reviews.photographerId))
    .leftJoin(galleries, eq(galleries.id, reviews.galleryId))
    .where(eq(reviews.token, token));
  if (!row) notFound();
  const { review, studio } = row;
  const name = studio.businessName || studio.name;
  const logoUrl = studio.studioLogoKey ? await signedViewUrl(studio.studioLogoKey) : null;

  // Their final photos, so they can pick one to show with the review.
  const finals = review.galleryId
    ? await db
        .select({ id: photos.id, fileKey: photos.fileKey, name: photos.originalName })
        .from(photos)
        .where(and(eq(photos.galleryId, review.galleryId), eq(photos.kind, "final")))
        .orderBy(asc(photos.position))
        .limit(MAX_PHOTO_CHOICES)
    : [];
  const choices = await Promise.all(
    finals.map(async (photo) => ({ id: photo.id, name: photo.name, url: await signedViewUrl(photoKey(photo.fileKey, "thumb")) })),
  );

  const done = review.status !== "requested";

  return (
    <div className="flex flex-1 flex-col">
      <StudioNav slug={studio.studioSlug} name={name} logoUrl={logoUrl} logoBg={studio.studioLogoBg} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <div className="card p-6 sm:p-10">
          {done ? (
            <div className="text-center">
              <p className="text-5xl">💛</p>
              <h1 className="mt-4 font-display text-3xl font-bold">Thank you for your review!</h1>
              <p className="mt-3 text-muted">
                {name} has your review. It means a lot and helps other clients find them.
              </p>
              {review.rating !== null && offerGoogle(review.rating, studio.googleReviewUrl) && (
                <a href={studio.googleReviewUrl!} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6">
                  Share it on Google too
                </a>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm font-bold tracking-wider text-sky uppercase">{name}</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">How did we do?</h1>
              <p className="mt-2 text-muted">
                {row.galleryTitle ? `Tell us about your experience and your photos from "${row.galleryTitle}".` : "Tell us about your experience."}{" "}
                {name} reads every review before it&apos;s shared.
              </p>
              <div className="mt-8">
                <ReviewForm
                  token={token}
                  studioName={name}
                  suggestedName={defaultDisplayName(review.clientName)}
                  photos={choices}
                />
              </div>
            </>
          )}
        </div>
      </main>
      <StudioFooter />
    </div>
  );
}
