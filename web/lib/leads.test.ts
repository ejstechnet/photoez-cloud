// Tests for the landing page's email checks.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanSource, normalizeEmail } from "./leads.ts";

test("emails are trimmed and lowercased; junk is refused", () => {
  assert.equal(normalizeEmail("  Elle@Example.COM "), "elle@example.com");
  assert.equal(normalizeEmail("not an email"), null);
  assert.equal(normalizeEmail("a@b"), null);
  assert.equal(normalizeEmail("two@example.com three@example.com"), null);
  assert.equal(normalizeEmail(`${"a".repeat(250)}@example.com`), null);
  assert.equal(normalizeEmail(undefined), null);
});

test("the source tag is kept short and plain", () => {
  assert.equal(cleanSource("Facebook-Ad_1"), "facebook-ad_1");
  assert.equal(cleanSource("<script>x</script>"), "scriptxscript");
  assert.equal(cleanSource(""), null);
  assert.equal(cleanSource(["a"]), null);
  assert.equal(cleanSource("x".repeat(100))?.length, 40);
});
