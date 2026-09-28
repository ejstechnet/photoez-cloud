// Tests for the automatic booking gallery's title.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingGalleryTitle } from "./booking-gallery-title.ts";

test("a booking's gallery is titled with the session, client, and the studio's day", () => {
  // 11pm Oct 3 in Los Angeles is already Oct 4 in UTC.
  const startsAt = new Date("2026-10-04T06:00:00Z");
  assert.equal(
    bookingGalleryTitle("Family Session", "Maya Brooks", startsAt, "America/Los_Angeles"),
    "Family Session · Maya Brooks · Oct 3, 2026",
  );
});
