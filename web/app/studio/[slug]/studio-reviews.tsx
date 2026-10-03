import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { photos, reviews } from "@/db/schema";
import { siteUrl } from "@/lib/site";
import { averageRating } from "@/lib/reviews";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { ReviewRotator } from "./review-rotator";

// Published reviews on the studio page (PhotoEZ Reviews' review wall), with
// the average rating, each client's photo when they gave permission, and
// search-engine review markup built from these real reviews only.
export async function loadStudioReviews(photographerId: string) {
  const rows = await db
    .select({
      id: reviews.id,
      displayName: reviews.displayName,
      rating: reviews.rating,
      body: reviews.body,
      approvedAt: reviews.approvedAt,
      submittedAt: reviews.submittedAt,
      photoConsent: reviews.photoConsent,
      fileKey: photos.fileKey,
    })
    .from(reviews)
    .leftJoin(photos, eq(photos.id, reviews.photoId))
    .where(and(eq(reviews.photographerId, photographerId), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.submittedAt));
  const list = await Promise.all(
    rows
      .filter((r) => r.rating !== null && r.body)
      .map(async (r) => ({
        id: r.id,
        name: r.displayName ?? "A client",
        rating: r.rating!,
        body: r.body!,
        date: r.submittedAt ?? r.approvedAt,
        photoUrl: r.fileKey && r.photoConsent ? await signedViewUrl(photoKey(r.fileKey, "thumb")) : null,
      })),
  );
  return { list, average: averageRating(list.map((r) => r.rating)) };
}

type Loaded = Awaited<ReturnType<typeof loadStudioReviews>>;

function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <span className={`tracking-wider text-sun ${className}`} aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-border">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewItem({ review }: { review: Loaded["list"][number] }) {
  return (
    <div className="h-full rounded-2xl border-2 border-border p-4">
      <div className="flex gap-4">
        {review.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.photoUrl} alt={`Photo from ${review.name}'s session`} className="size-20 shrink-0 rounded-xl object-cover sm:size-24" />
        )}
        <div className="min-w-0">
          <Stars rating={review.rating} />
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{review.body}</p>
          <p className="mt-2 text-sm font-semibold">— {review.name}</p>
        </div>
      </div>
    </div>
  );
}

export function StudioReviews({ reviews: { list, average } }: { reviews: Loaded }) {
  if (list.length === 0 || average === null) return null;
  return (
    <div id="reviews" className="card scroll-mt-28 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-bold">What clients say</h2>
        <p className="text-sm text-muted">
          <Stars rating={Math.round(average)} className="text-base" />{" "}
          <strong className="text-foreground">{average.toFixed(1)}</strong> · {list.length}{" "}
          {list.length === 1 ? "review" : "reviews"}
        </p>
      </div>
      <ReviewRotator>
        {list.map((review) => (
          <ReviewItem key={review.id} review={review} />
        ))}
      </ReviewRotator>
    </div>
  );
}

// schema.org markup so search engines can show the studio's stars. Built only
// from real, approved reviews on this page.
// The studio as a business for search engines, with its star rating and
// reviews once it has some.
export function ReviewsJsonLd({
  name,
  slug,
  reviews: { list, average },
  description = null,
  areaServed = null,
}: {
  name: string;
  slug: string;
  reviews: Loaded;
  description?: string | null;
  areaServed?: string | null;
}) {
  const rated = list.length > 0 && average !== null;
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name,
    url: `${siteUrl}/studio/${slug}`,
    ...(description ? { description } : {}),
    ...(areaServed ? { areaServed } : {}),
    ...(rated
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: average, reviewCount: list.length, bestRating: 5 },
          review: list.slice(0, 10).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.name },
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            reviewBody: r.body,
            ...(r.date ? { datePublished: r.date.toISOString().slice(0, 10) } : {}),
          })),
        }
      : {}),
  };
  return (
    <script
      type="application/ld+json"
      // "<" is escaped so review text can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
