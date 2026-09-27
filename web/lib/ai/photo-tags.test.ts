// Tests for tidying gallery search tags.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTags } from "./photo-tags.ts";

test("tags are trimmed, lowercased, de-duplicated, and capped", () => {
  const result = cleanTags({
    description: "  A graduate in a cap and gown.  ",
    tags: ["Cap and Gown", "cap  and gown", " Graduate ", "", "x".repeat(60), ...Array.from({ length: 40 }, (_, i) => `tag ${i}`)],
  });
  assert.equal(result.description, "A graduate in a cap and gown.");
  assert.deepEqual(result.tags.slice(0, 2), ["cap and gown", "graduate"]);
  assert.equal(result.tags.length, 25);
  assert.ok(result.tags.every((t) => t.length <= 40));
});
