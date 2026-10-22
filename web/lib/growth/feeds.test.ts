// Reading Google Alerts and other feeds.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesInterest, parseFeed, plainText, unwrapGoogleUrl } from "./feeds.ts";

// The shape Google Alerts serves when an alert is set to "Deliver to: RSS feed".
const GOOGLE_ALERT = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:idx="urn:atom-extension:indexing">
<id>tag:google.com,2005:reader/user/1/state/com.google/alerts/2</id>
<title>Google Alert - &quot;Pixieset alternative&quot;</title>
<entry>
<id>tag:google.com,2013:googlealerts/feed:111</id>
<title type="html">Best &lt;b&gt;Pixieset alternative&lt;/b&gt; for a small studio?</title>
<link href="https://www.google.com/url?rct=j&amp;sa=t&amp;url=https://www.reddit.com/r/photography/comments/abc/best_pixieset_alternative/&amp;ct=ga&amp;cd=CAEY&amp;usg=AOv" />
<published>2026-10-21T14:05:00Z</published>
<updated>2026-10-21T14:05:00Z</updated>
<content type="html">I shoot seniors and the fees keep going up &lt;b&gt;Pixieset alternative&lt;/b&gt; anyone? &amp;nbsp;Need contracts too.</content>
</entry>
<entry>
<id>tag:google.com,2013:googlealerts/feed:222</id>
<title type="html">Gallery news</title>
<link href="javascript:alert(1)" />
<published>2026-10-20T10:00:00Z</published>
<content type="html">Bad link, skipped.</content>
</entry>
</feed>`;

const RSS = `<rss version="2.0"><channel><title>Forum</title>
<item><title><![CDATA[Which booking system do you use?]]></title><link>https://forum.example.com/t/42</link>
<description><![CDATA[<p>Moving off <b>HoneyBook</b>, need something simpler.</p>]]></description>
<pubDate>Tue, 21 Oct 2026 09:30:00 GMT</pubDate><guid>forum-42</guid></item>
<item><title>Best 85mm lens?</title><link>https://forum.example.com/t/43</link><description>Lens recommendation please</description></item>
</channel></rss>`;

test("Google Alerts entries come out with the real page link, plain text and date", () => {
  const items = parseFeed(GOOGLE_ALERT);
  assert.equal(items.length, 1, "the javascript: link is dropped");
  assert.deepEqual(items[0], {
    title: "Best Pixieset alternative for a small studio?",
    url: "https://www.reddit.com/r/photography/comments/abc/best_pixieset_alternative/",
    summary: "I shoot seniors and the fees keep going up Pixieset alternative anyone? Need contracts too.",
    publishedAt: new Date("2026-10-21T14:05:00Z"),
    id: "tag:google.com,2013:googlealerts/feed:111",
  });
});

test("plain RSS works too, CDATA and all", () => {
  const items = parseFeed(RSS);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Which booking system do you use?");
  assert.equal(items[0].summary, "Moving off HoneyBook, need something simpler.");
  assert.equal(items[0].id, "forum-42");
  assert.deepEqual(items[0].publishedAt, new Date("2026-10-21T09:30:00Z"));
  assert.equal(items[1].publishedAt, null);
});

test("helpers: links unwrapped, tags and entities gone", () => {
  assert.equal(unwrapGoogleUrl("https://www.google.com/url?url=https://a.com/x&ct=ga"), "https://a.com/x");
  assert.equal(unwrapGoogleUrl("https://a.com/y"), "https://a.com/y");
  assert.equal(plainText("&lt;script&gt;alert(1)&lt;/script&gt; Hi &amp; bye"), "alert(1) Hi & bye");
});

test("feeds that aren't searches are filtered by phrases and brand names", () => {
  const phrases = ["photography booking software", "what do you use for client galleries"];
  const negatives = ["lens recommendation", "looking to hire a photographer"];
  assert.equal(matchesInterest("Which booking system? Moving off HoneyBook", phrases, negatives), true);
  assert.equal(matchesInterest("What do you use for client galleries these days?", phrases, negatives), true);
  assert.equal(matchesInterest("Lens recommendation please", phrases, negatives), false);
  assert.equal(matchesInterest("Looking to hire a photographer, Pixieset gallery please", phrases, negatives), false);
  // Whole words only: "crm" inside another word doesn't count.
  assert.equal(matchesInterest("My acrmx camera", phrases, negatives), false);
});
