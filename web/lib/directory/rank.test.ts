import { test } from "node:test";
import assert from "node:assert/strict";
import { directoryScore, rankListings, type Rankable } from "./rank.ts";

const base: Rankable = { miles: 5, reviewCount: 0, rating: null, hasHeadshot: true, portfolioPhotos: 3 };

test("closer ranks higher when everything else is equal", () => {
  const ranked = rankListings(
    [
      { ...base, id: "far", miles: 20 },
      { ...base, id: "near", miles: 2 },
    ],
    25,
  );
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["near", "far"],
  );
});

test("a strong review record can beat a slightly closer photographer", () => {
  const reviewed = directoryScore({ ...base, miles: 8, reviewCount: 15, rating: 4.9 }, 25);
  const unreviewed = directoryScore({ ...base, miles: 5 }, 25);
  assert.ok(reviewed > unreviewed);
});

test("one 5-star review doesn't outrank many 4.9s", () => {
  const one = directoryScore({ ...base, reviewCount: 1, rating: 5 }, 25);
  const many = directoryScore({ ...base, reviewCount: 12, rating: 4.9 }, 25);
  assert.ok(many > one);
});

test("a new photographer right nearby still beats a well-reviewed one at the edge", () => {
  const newNearby = directoryScore({ ...base, miles: 1 }, 25);
  const reviewedFar = directoryScore({ ...base, miles: 24, reviewCount: 20, rating: 5 }, 25);
  assert.ok(newNearby > reviewedFar);
});

test("a complete profile helps", () => {
  const bare = directoryScore({ ...base, hasHeadshot: false, portfolioPhotos: 0 }, 25);
  assert.ok(directoryScore(base, 25) > bare);
});
