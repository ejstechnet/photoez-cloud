// Tests for review rules.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { averageRating, checkReview, defaultDisplayName, offerGoogle } from "./reviews.ts";

const good = {
  rating: 5,
  body: "Elle made our family feel so comfortable. The photos are stunning!",
  displayName: "Jasmine L.",
  photoId: null,
  photoConsent: false,
};

test("public name is first name and last initial", () => {
  assert.equal(defaultDisplayName("Jasmine Lee"), "Jasmine L.");
  assert.equal(defaultDisplayName("  mary ann  smith "), "mary S.");
  assert.equal(defaultDisplayName("Prince"), "Prince");
  assert.equal(defaultDisplayName(""), "");
});

test("a normal review passes, tidied", () => {
  const result = checkReview({ ...good, body: `  ${good.body}\r\n\r\n\r\n\r\nThanks!  ` });
  assert.ok("ok" in result);
  assert.equal(result.review.body, `${good.body}\n\nThanks!`);
});

test("stars are required and must be 1 to 5", () => {
  assert.deepEqual(checkReview({ ...good, rating: 0 }), { error: "Choose a star rating." });
  assert.deepEqual(checkReview({ ...good, rating: 6 }), { error: "Choose a star rating." });
  assert.deepEqual(checkReview({ ...good, rating: Number.NaN }), { error: "Choose a star rating." });
});

test("too short or too long is turned back", () => {
  assert.ok("error" in checkReview({ ...good, body: "Great!" }));
  assert.ok("error" in checkReview({ ...good, body: "x".repeat(2001) }));
});

test("a photo needs the client's OK", () => {
  assert.ok("error" in checkReview({ ...good, photoId: "p1", photoConsent: false }));
  const ok = checkReview({ ...good, photoId: "p1", photoConsent: true });
  assert.ok("ok" in ok && ok.review.photoConsent);
  // Consent without a photo isn't stored as consent.
  const none = checkReview({ ...good, photoConsent: true });
  assert.ok("ok" in none && !none.review.photoConsent);
});

test("average rating to one decimal", () => {
  assert.equal(averageRating([]), null);
  assert.equal(averageRating([5, 5, 4]), 4.7);
});

test("Google is offered only to 4-5 stars when the studio set a link", () => {
  assert.equal(offerGoogle(5, null), false);
  assert.equal(offerGoogle(3, "https://g.page/r/abc/review"), false);
  assert.equal(offerGoogle(4, "https://g.page/r/abc/review"), true);
  assert.equal(offerGoogle(5, "javascript:alert(1)"), false);
});
