import { and, asc, avg, between, count, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { photographers, reviews, sessionTypes, studioPhotos } from "@/db/schema";
import { currentPrice } from "@/lib/booking/pricing";
import { localDateOf } from "@/lib/booking/time";
import { milesBetween, type Place } from "@/lib/geo/zips";
import type { SessionType } from "@/lib/session-types";
import { signedViewUrl } from "@/lib/storage";
import { rankListings } from "./rank";

// The photographer directory (/photographers): studios that opted in and
// have a finished studio page, found by distance from a ZIP or city.

export const RADIUS_CHOICES = [10, 25, 50, 100] as const;
export const DEFAULT_RADIUS = 25;

// What a studio needs before it can be listed, for the Settings checklist.
export async function directoryReadiness(photographerId: string) {
  const [[studio], [sessions]] = await Promise.all([
    db
      .select({ slug: photographers.studioSlug, bio: photographers.studioBio, zip: photographers.directoryZip })
      .from(photographers)
      .where(eq(photographers.id, photographerId)),
    db
      .select({ n: count() })
      .from(sessionTypes)
      .where(and(eq(sessionTypes.photographerId, photographerId), eq(sessionTypes.hidden, false))),
  ]);
  const steps = [
    { done: Boolean(studio.slug), label: "Studio page address", href: "/dashboard/settings#studio" },
    { done: Boolean(studio.bio), label: "About section", href: "/dashboard/settings#studio" },
    { done: sessions.n > 0, label: "At least one session clients can book", href: "/dashboard/bookings/setup" },
    { done: Boolean(studio.zip), label: "Your studio's ZIP code", href: "#directory" },
  ];
  return { steps, ready: steps.every((s) => s.done) };
}

// Listed studios with a finished page (address, About, a visible session).
const listed = and(
  eq(photographers.directoryListed, true),
  isNotNull(photographers.studioSlug),
  isNotNull(photographers.studioBio),
  isNotNull(photographers.directoryLat),
  sql`exists (select 1 from ${sessionTypes} where ${sessionTypes.photographerId} = ${photographers.id} and ${sessionTypes.hidden} = false)`,
);

export type Listing = Awaited<ReturnType<typeof searchDirectory>>[number];

export async function searchDirectory({
  center,
  radiusMiles,
  type,
}: {
  center: Place;
  radiusMiles: number;
  type?: SessionType | null;
}) {
  // A box around the center first (cheap in SQL), then exact miles below.
  const latSpan = radiusMiles / 69;
  const lngSpan = radiusMiles / (69 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.1));
  const rows = await db
    .select({
      id: photographers.id,
      name: photographers.name,
      businessName: photographers.businessName,
      slug: photographers.studioSlug,
      tagline: photographers.studioTagline,
      city: photographers.directoryCity,
      state: photographers.directoryState,
      lat: photographers.directoryLat,
      lng: photographers.directoryLng,
      offeredTypes: photographers.offeredTypes,
      headshotKey: photographers.headshotKey,
      logoKey: photographers.studioLogoKey,
      timeZone: photographers.timeZone,
    })
    .from(photographers)
    .where(
      and(
        listed,
        between(photographers.directoryLat, center.lat - latSpan, center.lat + latSpan),
        between(photographers.directoryLng, center.lng - lngSpan, center.lng + lngSpan),
        type ? sql`${photographers.offeredTypes} @> ${JSON.stringify([type])}::jsonb` : undefined,
      ),
    );
  const near = rows
    .map((row) => ({ ...row, miles: milesBetween(center, { lat: row.lat!, lng: row.lng! }) }))
    .filter((row) => row.miles <= radiusMiles);
  if (near.length === 0) return [];
  const ids = near.map((row) => row.id);

  const [ratings, photos, sessions] = await Promise.all([
    db
      .select({ id: reviews.photographerId, n: count(), rating: avg(reviews.rating) })
      .from(reviews)
      .where(and(inArray(reviews.photographerId, ids), eq(reviews.status, "approved")))
      .groupBy(reviews.photographerId),
    db
      .select({ id: studioPhotos.photographerId, fileKey: studioPhotos.fileKey })
      .from(studioPhotos)
      .where(inArray(studioPhotos.photographerId, ids))
      .orderBy(asc(studioPhotos.position), asc(studioPhotos.createdAt)),
    db
      .select({
        id: sessionTypes.photographerId,
        priceCents: sessionTypes.priceCents,
        salePriceCents: sessionTypes.salePriceCents,
        saleEndsOn: sessionTypes.saleEndsOn,
      })
      .from(sessionTypes)
      .where(and(inArray(sessionTypes.photographerId, ids), eq(sessionTypes.hidden, false))),
  ]);

  const listings = near.map((row) => {
    const rated = ratings.find((r) => r.id === row.id);
    const today = localDateOf(new Date(), row.timeZone);
    const prices = sessions.filter((s) => s.id === row.id).map((s) => currentPrice(s, today).priceCents);
    return {
      ...row,
      studioName: row.businessName || row.name,
      reviewCount: rated?.n ?? 0,
      rating: rated?.rating ? Math.round(Number(rated.rating) * 10) / 10 : null,
      hasHeadshot: Boolean(row.headshotKey),
      photoKeys: photos.filter((p) => p.id === row.id).map((p) => p.fileKey),
      portfolioPhotos: photos.filter((p) => p.id === row.id).length,
      startingCents: prices.length ? Math.min(...prices) : null,
    };
  });

  return Promise.all(
    rankListings(listings, radiusMiles).map(async (listing) => ({
      ...listing,
      imageUrl: listing.headshotKey
        ? await signedViewUrl(listing.headshotKey)
        : listing.logoKey
          ? await signedViewUrl(listing.logoKey)
          : null,
      photoUrls: await Promise.all(listing.photoKeys.slice(0, 3).map((key) => signedViewUrl(key))),
    })),
  );
}

// Cities with listed photographers, for the state pages and the sitemap.
export async function listedCities(state?: string) {
  return db
    .select({ city: photographers.directoryCity, state: photographers.directoryState, n: count() })
    .from(photographers)
    .where(and(listed, state ? eq(photographers.directoryState, state.toUpperCase()) : undefined))
    .groupBy(photographers.directoryCity, photographers.directoryState)
    .orderBy(asc(photographers.directoryState), asc(photographers.directoryCity));
}

export async function listedStudioSlugs() {
  const rows = await db.select({ slug: photographers.studioSlug }).from(photographers).where(listed);
  return rows.map((r) => r.slug!);
}
