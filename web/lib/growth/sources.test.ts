// The Growth Sources page: feeds, searches, community rules and phrases.
// Runs against the in-memory Postgres (test/db.ts).   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { growthSources } from "@/db/schema";
import { ensureGrowthSeeded } from "./opportunities";
import { addKeyword, deleteSource, listKeywords, saveSource, savedSearches, type SourceInput } from "./sources";

const feed = (over: Partial<SourceInput> = {}): SourceInput => ({
  name: "Google Alert: deliver photos",
  platform: "web",
  kind: "rss",
  feedUrl: "https://www.google.com/alerts/feeds/123/456",
  searchUrl: "",
  filter: "none",
  enabled: true,
  linksAllowed: false,
  selfPromoAllowed: false,
  disclosure: "",
  rulesNote: "",
  ...over,
});

test("a Google Alert feed is added with safe defaults, and only https feeds are accepted", async () => {
  await ensureGrowthSeeded();
  assert.deepEqual(await saveSource(feed({ feedUrl: "http://insecure.example/feed" })), { problems: { feedUrl: "Paste the feed's https address." } });
  assert.deepEqual(await saveSource(feed({ feedUrl: "" })), { problems: { feedUrl: "Paste the feed's https address." } });
  assert.deepEqual(await saveSource(feed({ name: " " })), { problems: { name: "Give it a name." } });

  const made = await saveSource(feed());
  assert.ok("id" in made);
  const [row] = await db.select().from(growthSources).where(eq(growthSources.id, made.id));
  assert.deepEqual(row.config, { feedUrl: "https://www.google.com/alerts/feeds/123/456", filter: "none" });
  assert.equal(row.disclosure, "I make PhotoEZ Cloud, so I'm biased.");

  assert.deepEqual(await saveSource(feed()), { problems: { name: "Another source already has that name." } });
});

test("changing a feed's address reads it again on the next run", async () => {
  const [row] = await db.select().from(growthSources).where(eq(growthSources.name, "Google Alert: deliver photos"));
  await db.update(growthSources).set({ lastRunAt: new Date() }).where(eq(growthSources.id, row.id));
  await saveSource(feed({ feedUrl: "https://www.google.com/alerts/feeds/123/789" }), row.id);
  const [after] = await db.select().from(growthSources).where(eq(growthSources.id, row.id));
  assert.equal(after.lastRunAt, null);
  await deleteSource(row.id);
  assert.equal((await db.select().from(growthSources).where(eq(growthSources.id, row.id))).length, 0);
});

test("searches Elle runs herself become one-click buttons", async () => {
  const searches = await savedSearches();
  assert.ok(searches.some((s) => s.name === "Facebook search: how do you deliver photos to clients" && s.url.startsWith("https://www.facebook.com/search/top?q=")));

  const made = await saveSource(feed({ name: "Reddit search: Pixieset", kind: "manual", feedUrl: "", searchUrl: "https://www.reddit.com/search/?q=pixieset&sort=new" }));
  assert.ok("id" in made);
  assert.ok((await savedSearches()).some((s) => s.name === "Reddit search: Pixieset"));
  assert.deepEqual(await saveSource(feed({ name: "Bad search", kind: "manual", feedUrl: "", searchUrl: "javascript:alert(1)" })), {
    problems: { searchUrl: "Paste the search's https address." },
  });
});

test("phrases: Elle's delivery question is there, and new ones are added once", async () => {
  const phrases = (await listKeywords()).map((k) => k.phrase);
  assert.ok(phrases.includes("how do you deliver photos to clients"));
  assert.equal(await addKeyword("buying_intent", "best client gallery app"), null);
  assert.equal(await addKeyword("buying_intent", "best client gallery app"), "That phrase is already there.");
  assert.equal(await addKeyword("nonsense", "x y"), "Invalid option: expected one of \"alternatives\"|\"proofing_galleries\"|\"business_management\"|\"buying_intent\"|\"negative\"");
});
