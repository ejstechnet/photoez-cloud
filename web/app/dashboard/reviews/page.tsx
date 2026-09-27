import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { galleries, photographers, photos, reviews } from "@/db/schema";
import { formatDate } from "@/lib/booking/time";
import { averageRating } from "@/lib/reviews";
import { requirePhotographer } from "@/lib/session";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { ReviewActions } from "./review-actions";

export const metadata = { title: "Reviews · PhotoEZ Cloud" };

const TABS = [
  { key: "submitted", label: "To approve" },
  { key: "approved", label: "Published" },
  { key: "requested", label: "Waiting on client" },
  { key: "rejected", label: "Hidden" },
] as const;
type Tab = (typeof TABS)[number]["key"];

// Reviews from clients: approve them before they show on the studio page
// (PhotoEZ Reviews' screening), plus the requests still waiting on a reply.
export default async function ReviewsPage({ searchParams }: PageProps<"/dashboard/reviews">) {
  const user = await requirePhotographer();
  const { show } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === show) ? (show as Tab) : "submitted";

  const [studio] = await db
    .select({ timeZone: photographers.timeZone, slug: photographers.studioSlug, days: photographers.reviewRequestDays })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const counts = Object.fromEntries(
    (
      await db
        .select({ status: reviews.status, n: count() })
        .from(reviews)
        .where(eq(reviews.photographerId, user.id))
        .groupBy(reviews.status)
    ).map((row) => [row.status, row.n]),
  ) as Partial<Record<Tab, number>>;
  const published = await db
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.photographerId, user.id), eq(reviews.status, "approved")));
  const average = averageRating(published.flatMap((r) => (r.rating === null ? [] : [r.rating])));

  const rows = await db
    .select({ review: reviews, galleryTitle: galleries.title, photoKey: photos.fileKey })
    .from(reviews)
    .leftJoin(galleries, eq(galleries.id, reviews.galleryId))
    .leftJoin(photos, eq(photos.id, reviews.photoId))
    .where(and(eq(reviews.photographerId, user.id), eq(reviews.status, tab)))
    .orderBy(desc(tab === "requested" ? reviews.requestedAt : reviews.submittedAt))
    .limit(200);
  const list = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      photoUrl: row.photoKey && row.review.photoConsent ? await signedViewUrl(photoKey(row.photoKey, "thumb")) : null,
    })),
  );

  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-sky uppercase">What clients say</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Reviews</h1>
        {average !== null && (
          <p className="text-lg font-semibold">
            <span className="text-sun">★</span> {average.toFixed(1)}{" "}
            <span className="text-sm font-normal text-muted">from {published.length} published</span>
          </p>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-muted">
        {studio.days
          ? `Clients are asked for a review ${studio.days} ${studio.days === 1 ? "day" : "days"} after their gallery is delivered. `
          : "Automatic review requests are off. "}
        You can also ask from any delivered gallery. Reviews show on your{" "}
        {studio.slug ? (
          <Link href={`/studio/${studio.slug}#reviews`} className="link">
            studio page
          </Link>
        ) : (
          "studio page"
        )}{" "}
        only after you approve them. Change the timing in{" "}
        <Link href="/dashboard/settings#reviews" className="link">
          Settings
        </Link>
        .
      </p>

      <nav className="mt-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/reviews?show=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-xs font-bold tracking-wider uppercase transition ${
              tab === t.key ? "bg-brand text-white" : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {counts[t.key] ? ` (${counts[t.key]})` : ""}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <div className="card mt-6 p-8 text-center text-muted">
          {tab === "submitted" ? "No new reviews to approve right now." : "Nothing here yet."}
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {list.map(({ review, galleryTitle, photoUrl }) => (
            <li key={review.id} className="card flex flex-col gap-4 p-6 sm:flex-row">
              {photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="size-28 shrink-0 rounded-2xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {review.rating !== null && (
                    <span className="text-lg tracking-wider text-sun" aria-label={`${review.rating} out of 5 stars`}>
                      {"★".repeat(review.rating)}
                      <span className="text-border">{"★".repeat(5 - review.rating)}</span>
                    </span>
                  )}
                  <span className="font-semibold">{review.displayName ?? review.clientName}</span>
                  <span className="text-sm text-muted">
                    {review.clientName} · {review.clientEmail}
                  </span>
                </div>
                {review.body ? (
                  <p className="mt-2 whitespace-pre-line">{review.body}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    Asked {formatDate(review.requestedAt, studio.timeZone, "short")}. No review yet.
                  </p>
                )}
                <p className="mt-3 text-xs text-muted">
                  {review.submittedAt && `Sent ${formatDate(review.submittedAt, studio.timeZone, "short")}`}
                  {galleryTitle && review.galleryId && (
                    <>
                      {review.submittedAt && " · "}
                      <Link href={`/dashboard/galleries/${review.galleryId}`} className="hover:underline">
                        {galleryTitle}
                      </Link>
                    </>
                  )}
                  {review.photoId && !review.photoConsent && " · Photo not shown (no permission)"}
                </p>
                <div className="mt-4">
                  <ReviewActions reviewId={review.id} status={review.status} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
