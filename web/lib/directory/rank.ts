// How the photographer directory orders results (decided with Elle
// 2026-09-27): a blend of closeness, reviews, and a complete profile, so
// good reviews count but a new photographer nearby still shows up.
// Tested in rank.test.ts.

export type Rankable = {
  miles: number;
  reviewCount: number;
  // Average star rating (1–5), or null with no rated reviews.
  rating: number | null;
  hasHeadshot: boolean;
  portfolioPhotos: number;
};

// A new photographer counts as having a few 4-star reviews, so one 5-star
// review doesn't outrank a long record of 4.9s.
const PRIOR_REVIEWS = 3;
const PRIOR_RATING = 4;

export function directoryScore(p: Rankable, radiusMiles: number) {
  const closeness = Math.max(0, 1 - p.miles / Math.max(radiusMiles, 1));
  const rated = p.rating === null ? 0 : p.reviewCount;
  const average = (PRIOR_RATING * PRIOR_REVIEWS + (p.rating ?? 0) * rated) / (PRIOR_REVIEWS + rated);
  const reviews = (average - 1) / 4;
  const volume = Math.min(p.reviewCount, 20) / 20;
  const profile = (p.hasHeadshot ? 0.5 : 0) + Math.min(p.portfolioPhotos, 3) / 6;
  return 0.5 * closeness + 0.3 * reviews + 0.1 * volume + 0.1 * profile;
}

export function rankListings<T extends Rankable>(listings: T[], radiusMiles: number): T[] {
  return listings
    .map((listing) => ({ listing, score: directoryScore(listing, radiusMiles) }))
    .sort((a, b) => b.score - a.score || a.listing.miles - b.listing.miles)
    .map(({ listing }) => listing);
}
