// Post links in one standard form, so a post isn't saved twice.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalUrl, platformFromUrl } from "./urls.ts";

test("phone, share and tracking versions of a Facebook post are the same link", () => {
  const canonical = "https://www.facebook.com/groups/12345/posts/67890";
  for (const variant of [
    "https://www.facebook.com/groups/12345/posts/67890/",
    "https://m.facebook.com/groups/12345/posts/67890/?mibextid=abc",
    "http://facebook.com/groups/12345/posts/67890/?__cft__[0]=AZX&__tn__=%2CO%2CP-R#comments",
    "https://web.facebook.com/groups/12345/posts/67890?fbclid=IwAR0&utm_source=share",
  ]) {
    assert.equal(canonicalUrl(variant), canonical, variant);
  }
});

test("links keep the parts that pick the page, in a fixed order", () => {
  assert.equal(
    canonicalUrl("https://www.facebook.com/permalink.php?story_fbid=9&id=4&__tn__=K"),
    "https://www.facebook.com/permalink.php?id=4&story_fbid=9",
  );
  assert.equal(
    canonicalUrl("https://old.reddit.com/r/photography/comments/abc/which_gallery_app/?utm_medium=android"),
    "https://www.reddit.com/r/photography/comments/abc/which_gallery_app",
  );
  assert.equal(canonicalUrl("https://forum.example.com/"), "https://forum.example.com/");
});

test("anything that isn't a web link is refused", () => {
  assert.equal(canonicalUrl("not a link"), null);
  assert.equal(canonicalUrl("javascript:alert(1)"), null);
  assert.equal(canonicalUrl("mailto:someone@example.com"), null);
});

test("links are sorted by where they're from", () => {
  assert.equal(platformFromUrl("https://www.facebook.com/groups/1"), "facebook");
  assert.equal(platformFromUrl("https://www.reddit.com/r/photography"), "reddit");
  assert.equal(platformFromUrl("https://www.fredmiranda.com/forum/topic/1"), "web");
  assert.equal(platformFromUrl("nonsense"), "other");
});
