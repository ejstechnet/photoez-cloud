// Tests for the public forms' per-visitor limit.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { allowHit, type Hits } from "./rate-limit-rules.ts";

test("allows up to the limit in the window, then refuses", () => {
  const hits: Hits = new Map();
  for (let i = 0; i < 3; i++) assert.equal(allowHit(hits, "inquiry:1.2.3.4", 1000 + i, 3, 60_000), true);
  assert.equal(allowHit(hits, "inquiry:1.2.3.4", 1010, 3, 60_000), false);
  // Another visitor isn't affected.
  assert.equal(allowHit(hits, "inquiry:5.6.7.8", 1010, 3, 60_000), true);
});

test("tries older than the window stop counting", () => {
  const hits: Hits = new Map();
  for (let i = 0; i < 3; i++) allowHit(hits, "k", i, 3, 1000);
  assert.equal(allowHit(hits, "k", 500, 3, 1000), false);
  assert.equal(allowHit(hits, "k", 1003, 3, 1000), true);
});
