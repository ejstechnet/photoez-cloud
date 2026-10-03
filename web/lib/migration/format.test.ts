// Tests for the PhotoEZ Migration format helpers.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { KEY_PREFIX, hashMigrationKey, isGalleryStatus, keyFromHeader, newMigrationKey, pageParams, toPage } from "./format.ts";

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
