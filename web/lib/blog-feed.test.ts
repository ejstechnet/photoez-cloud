// Tests for reading the EJS Tech blog feed.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanExcerpt, decodeEntities, ogDescription, ogImage, parseFeed } from "./blog-feed.ts";

const FEED = `<?xml version="1.0"?><rss><channel><title>EJS Tech</title><link>https://ejstech.net</link>
<item>
  <title>Why I Built PhotoEZ: A Photographer&#8217;s Workflow</title>
  <link>https://ejstech.net/why-i-built-photoez/</link>
  <pubDate>Mon, 17 Aug 2026 19:02:43 +0000</pubDate>
  <category><![CDATA[Software Reviews]]></category>
  <description><![CDATA[Why I Built PhotoEZ: A Photographer&#8217;s Workflow Why I Built PhotoEZ: A Photographer&#8217;s Workflow After 17 frustrating years as a photographer there&#8217;s no shortage of plugins [&#8230;]]]></description>
</item>
<item><title>No link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

test("feed items become article cards", () => {
  const posts = parseFeed(FEED);
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0], {
    title: "Why I Built PhotoEZ: A Photographer’s Workflow",
    url: "https://ejstech.net/why-i-built-photoez/",
    date: "2026-08-17",
    category: "Software Reviews",
    excerpt: "After 17 frustrating years as a photographer there’s no shortage of plugins",
    image: null,
  });
});

test("entities and long excerpts", () => {
  assert.equal(decodeEntities("A &amp; B &#8212; C&#x2019;s"), "A & B — C’s");
  const long = cleanExcerpt("<p>" + "word ".repeat(100) + "</p>", "Title", 40);
  assert.ok(long.length <= 41 && long.endsWith("…"));
});

test("article images come from og:image", () => {
  assert.equal(ogImage('<meta property="og:image" content="https://ejstech.net/a.png" />'), "https://ejstech.net/a.png");
  assert.equal(ogImage('<meta property="og:image" content="http://insecure/a.png" />'), null);
  assert.equal(ogImage("<html></html>"), null);
});

test("good search descriptions are used, short ones aren't", () => {
  const long = "Why I Built PhotoEZ: A Photographer&#039;s Workflow — a 17-year photographer&#039;s story of ditching subscription tools.";
  assert.equal(ogDescription(`<meta property="og:description" content="${long}" />`), "Why I Built PhotoEZ: A Photographer's Workflow — a 17-year photographer's story of ditching subscription tools.");
  assert.equal(ogDescription('<meta property="og:description" content="PhotoEZ VS Pixieset: An honest comparison" />'), null);
});
