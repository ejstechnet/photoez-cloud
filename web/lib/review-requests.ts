import { randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, galleries, photographers, reviews } from "@/db/schema";
import { reviewRequestClient, reviewSubmittedStudio } from "@/lib/email/messages";
import { sendToClient, sendToStudio } from "@/lib/email/send";
import { siteUrl } from "@/lib/site";

// Asking for reviews and telling the studio when one arrives (PhotoEZ Reviews).

const reviewUrl = (token: string) => `${siteUrl}/review/${token}`;

async function sendRequest(reviewId: string) {
  const [row] = await db
    .select({ review: reviews, galleryTitle: galleries.title, studioName: photographers.businessName, name: photographers.name })
    .from(reviews)
    .innerJoin(photographers, eq(photographers.id, reviews.photographerId))
    .leftJoin(galleries, eq(galleries.id, reviews.galleryId))
    .where(eq(reviews.id, reviewId));
  if (!row) return false;
  const { review } = row;
  return sendToClient(
    review.photographerId,
    "review_request",
    review.clientEmail,
    reviewRequestClient({
      studioName: row.studioName || row.name,
      clientName: review.clientName,
      galleryTitle: row.galleryTitle,
      url: reviewUrl(review.token),
    }),
    { galleryId: review.galleryId ?? undefined },
  );
}

// Creates the gallery's review request (once) and emails it. Asking again
// before they've answered re-sends the same link.
export async function requestReview(galleryId: string): Promise<{ ok: true; to: string } | { error: string }> {
  const [gallery] = await db
    .select({ photographerId: galleries.photographerId, clientName: clients.name, clientEmail: clients.email })
    .from(galleries)
    .leftJoin(clients, eq(clients.id, galleries.clientId))
    .where(eq(galleries.id, galleryId));
  if (!gallery) return { error: "That gallery could not be found." };
  if (!gallery.clientEmail) return { error: "Add an email address for this client first." };

  const [existing] = await db.select().from(reviews).where(eq(reviews.galleryId, galleryId));
  if (existing && existing.status !== "requested") return { error: "This client has already left a review." };

  const reviewId =
    existing?.id ??
    (
      await db
        .insert(reviews)
        .values({
          photographerId: gallery.photographerId,
          galleryId,
          clientName: gallery.clientName ?? "there",
          clientEmail: gallery.clientEmail,
          token: randomBytes(24).toString("base64url"),
        })
        .returning({ id: reviews.id })
    )[0].id;
  if (existing) await db.update(reviews).set({ requestedAt: new Date() }).where(eq(reviews.id, existing.id));

  const sent = await sendRequest(reviewId);
  return sent || !process.env.SMTP_HOST ? { ok: true, to: gallery.clientEmail } : { error: "The email couldn't be sent. See the Email log." };
}

// The scheduled job: ask clients whose gallery was delivered N days ago
// (the studio's setting). Galleries delivered long before reviews existed
// aren't asked: only those delivered within the last week of that window.
export async function sendDueReviewRequests(now = new Date()) {
  const due = await db
    .select({ id: galleries.id })
    .from(galleries)
    .innerJoin(photographers, eq(photographers.id, galleries.photographerId))
    .innerJoin(clients, eq(clients.id, galleries.clientId))
    .leftJoin(reviews, eq(reviews.galleryId, galleries.id))
    .where(
      and(
        inArray(galleries.status, ["delivered", "completed"]),
        isNotNull(photographers.reviewRequestDays),
        isNotNull(clients.email),
        isNull(reviews.id),
        lte(galleries.deliveredAt, sql`${now.toISOString()}::timestamptz - make_interval(days => ${photographers.reviewRequestDays})`),
        gt(galleries.deliveredAt, sql`${now.toISOString()}::timestamptz - make_interval(days => ${photographers.reviewRequestDays} + 7)`),
      ),
    );
  let sent = 0;
  for (const gallery of due) {
    const result = await requestReview(gallery.id);
    if ("ok" in result) sent++;
  }
  return sent;
}

export async function emailReviewSubmitted(reviewId: string) {
  const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  if (!review || review.rating === null || !review.body) return;
  await sendToStudio(
    review.photographerId,
    "review_new",
    reviewSubmittedStudio({
      clientName: review.clientName,
      rating: review.rating,
      body: review.body,
      withPhoto: Boolean(review.photoId && review.photoConsent),
      dashboardUrl: `${siteUrl}/dashboard/reviews`,
    }),
    { galleryId: review.galleryId ?? undefined, replyTo: review.clientEmail },
  );
}
