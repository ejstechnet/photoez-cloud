// Tests for the PhotoEZ Migration format helpers.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { KEY_PREFIX, chosenTotals, hashMigrationKey, isGalleryStatus, keyFromHeader, newMigrationKey, pageParams, toPage } from "./format.ts";

test("keys look right and hash the same every time", () => {
  const key = newMigrationKey();
  assert.ok(key.startsWith(KEY_PREFIX) && key.length > 30);
  assert.equal(hashMigrationKey(key), hashMigrationKey(` ${key} `));
  assert.notEqual(hashMigrationKey(key), hashMigrationKey(newMigrationKey()));
});

test("the key is read from the Authorization header", () => {
  const key = newMigrationKey();
  assert.equal(keyFromHeader(`Bearer ${key}`), key);
  assert.equal(keyFromHeader(key), null);
  assert.equal(keyFromHeader("Bearer abc"), null);
  assert.equal(keyFromHeader(null), null);
});

test("paging stays in range", () => {
  assert.deepEqual(pageParams(new URLSearchParams("")), { offset: 0, limit: 50 });
  assert.deepEqual(pageParams(new URLSearchParams("offset=-5&limit=9999")), { offset: 0, limit: 100 });
  assert.deepEqual(pageParams(new URLSearchParams("offset=20&limit=abc")), { offset: 20, limit: 50 });
  assert.deepEqual(toPage([1, 2, 3], 0, 2), { items: [1, 2], next: 2 });
  assert.deepEqual(toPage([1, 2], 4, 2), { items: [1, 2], next: null });
});

test("gallery stages", () => {
  assert.ok(isGalleryStatus("paid_and_submitted"));
  assert.ok(!isGalleryStatus("archived"));
});

test("totals count only what was chosen", () => {
  const counts = { clients: 13, galleries: 3, photos: 60, sessionTypes: 4, addons: 5, contracts: 2 };
  const galleries = [
    { id: "a", photos: 10 },
    { id: "b", photos: 20 },
    { id: "c", photos: 30 },
  ];
  assert.deepEqual(chosenTotals(counts, { clients: false, sessions: true, contracts: false, galleryIds: ["a", "c"], clientIds: ["x"] }, galleries), {
    clients: 1,
    addons: 5,
    sessionTypes: 4,
    contracts: 0,
    galleries: 2,
    photos: 40,
  });
});
