// Automatic finding from feeds, with a stand-in feed and stand-in AI (no
// network, no cost). Runs against the in-memory Postgres (test/db.ts).
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { growthJobRuns, growthOpportunities, growthSources } from "@/db/schema";
import { runDiscovery } from "./discover";
import { createOpportunity, ensureGrowthSeeded, listOpportunities } from "./opportunities";
import type { QualifyOutcome } from "./qualify";

const NOW = new Date("2026-10-22T15:00:00Z");

const alertFeed = (entries: { id: string; url: string; title: string; text: string; at: string }[]) => `<feed xmlns="http://www.w3.org/2005/Atom">${entries
  .map(
    (e) =>
      `<entry><id>${e.id}</id><title type="html">${e.title}</title><link href="https://www.google.com/url?rct=j&amp;sa=t&amp;url=${encodeURIComponent(e.url)}&amp;ct=ga" /><published>${e.at}</published><content type="html">${e.text}</content></entry>`,
  )
  .join("")}</feed>`;

const FEED = alertFeed([
  { id: "a1", url: "https://www.reddit.com/r/photography/comments/a1/pixieset_alternative/", title: "Pixieset alternative?", text: "Seniors photographer, fees too high, need contracts too", at: "2026-10-22T09:00:00Z" },
  { id: "a2", url: "https://forum.example.com/t/lens", title: "Pixieset alternative lens", text: "Which lens should I buy", at: "2026-10-21T09:00:00Z" },
  { id: "a3", url: "https://blog.example.com/old-post", title: "Old Pixieset alternative post", text: "From long ago", at: "2026-06-01T09:00:00Z" },
]);

// Stand-in AI: the lens post isn't about business software.
function fakeAnalyze(calls: string[]) {
  return async (id: string): Promise<QualifyOutcome> => {
    calls.push(id);
    const [post] = await db.select().from(growthOpportunities).where(eq(growthOpportunities.id, id));
    if (/lens/i.test(post.excerpt ?? "")) {
      await db.update(growthOpportunities).set({ score: 0, tier: "low" }).where(eq(growthOpportunities.id, id));
      return { status: "not_relevant", reason: "Lens advice" };
    }
    await db.update(growthOpportunities).set({ score: 81, tier: "high" }).where(eq(growthOpportunities.id, id));
    return { status: "scored", total: 81, cached: false };
  };
}

test("a Google Alerts feed fills the queue, skipping old and off-topic posts", async () => {
  await ensureGrowthSeeded();
  const [source] = await db
    .insert(growthSources)
    .values({ name: "Google Alert: Pixieset alternative", platform: "web", kind: "rss", config: { feedUrl: "https://www.google.com/alerts/feeds/1/2" } })
    .returning();

  const calls: string[] = [];
  const fetched: string[] = [];
  const deps = { fetchText: async (url: string) => (fetched.push(url), FEED), analyze: fakeAnalyze(calls), now: NOW };
  const out = await runDiscovery(deps);
  assert.deepEqual(fetched, ["https://www.google.com/alerts/feeds/1/2"]);
  assert.deepEqual(out.sources[0], { source: "Google Alert: Pixieset alternative", found: 3, saved: 2, kept: 1 });

  // The good post is in the open queue; the lens one is kept but filtered out.
  const open = await listOpportunities();
  assert.deepEqual(
    open.filter((r) => r.sourceName === source.name).map((r) => r.url),
    ["https://www.reddit.com/r/photography/comments/a1/pixieset_alternative/"],
  );
  const screened = await listOpportunities({ status: "screened" });
  assert.equal(screened.length, 1);
  assert.equal(screened[0].url, "https://forum.example.com/t/lens");

  const [found] = await db.select().from(growthOpportunities).where(eq(growthOpportunities.externalId, "a1"));
  assert.deepEqual(found.publishedAt, new Date("2026-10-22T09:00:00Z"));

  const [job] = await db.select().from(growthJobRuns).where(eq(growthJobRuns.sourceId, source.id));
  assert.equal(job.status, "ok");

  // Read again within 6 hours: not due, nothing fetched.
  const soon = await runDiscovery({ ...deps, now: new Date(NOW.getTime() + 3_600_000) });
  assert.equal(soon.sources.length, 0);
  // After 6 hours: read again, but the same items aren't saved twice.
  const later = await runDiscovery({ ...deps, now: new Date(NOW.getTime() + 7 * 3_600_000) });
  assert.deepEqual(later.sources[0], { source: source.name, found: 3, saved: 0, kept: 0 });
  assert.equal(calls.length, 2);
});

test("the bookmark upgrades a found snippet to the full post", async () => {
  const url = "https://www.reddit.com/r/photography/comments/a1/pixieset_alternative/";
  const full = "Seniors photographer here. Pixieset fees keep going up and I still pay for a separate contracts app. What do you all use for galleries plus contracts plus booking in one place?";
  const result = await createOpportunity(
    { url, sourceId: null, title: null, excerpt: full, authorLabel: null, publishedAt: null, kind: "sales_opportunity" },
    { fillText: true },
  );
  assert.ok("id" in result && result.duplicate && result.updated);
  const [post] = await db.select().from(growthOpportunities).where(eq(growthOpportunities.id, result.id));
  assert.equal(post.excerpt, full);
  assert.equal(post.title, "Pixieset alternative?");

  // Without fillText (another feed read), a duplicate never overwrites.
  const again = await createOpportunity({ url, sourceId: null, title: null, excerpt: `${full} and more text here to be longer`, authorLabel: null, publishedAt: null, kind: "sales_opportunity" });
  assert.ok("id" in again && again.duplicate && !again.updated);
});

test("a broken feed is logged as an error, not a crash", async () => {
  const [source] = await db
    .insert(growthSources)
    .values({ name: "Broken feed", platform: "web", kind: "rss", config: { feedUrl: "https://example.com/feed" } })
    .returning();
  const out = await runDiscovery({
    fetchText: async () => {
      throw new Error("The feed answered 404.");
    },
    analyze: fakeAnalyze([]),
    now: new Date(NOW.getTime() + 24 * 3_600_000),
  });
  const mine = out.sources.find((s) => s.source === "Broken feed");
  assert.equal(mine && "error" in mine ? mine.error : null, "The feed answered 404.");
  const [job] = await db.select().from(growthJobRuns).where(eq(growthJobRuns.sourceId, source.id));
  assert.equal(job.status, "error");
});

test("a feed of every new thread keeps only posts about business tools", async () => {
  await db
    .insert(growthSources)
    .values({ name: "Forum new threads", platform: "forum", kind: "rss", config: { feedUrl: "https://forum.example.com/rss", filter: "keywords" } });
  const calls: string[] = [];
  const out = await runDiscovery({
    fetchText: async (url) =>
      url.includes("forum.example.com/rss")
        ? `<rss><channel>
<item><title>Which booking system do you use?</title><link>https://forum.example.com/t/100</link><description>Leaving HoneyBook</description><pubDate>Wed, 22 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Show me your sunsets</title><link>https://forum.example.com/t/101</link><description>Just for fun</description><pubDate>Wed, 22 Oct 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`
        : FEED,
    analyze: fakeAnalyze(calls),
    now: new Date(NOW.getTime() + 48 * 3_600_000),
  });
  const forum = out.sources.find((s) => s.source === "Forum new threads");
  assert.equal(forum?.found, 2);
  assert.equal(forum?.saved, 1);
});
