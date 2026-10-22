import { and, asc, eq, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { growthJobRuns, growthKeywords, growthOpportunities, growthSources } from "@/db/schema";
import { matchesInterest, parseFeed } from "./feeds";
import { createOpportunity } from "./opportunities";
import { analyzeOpportunity, type QualifyOutcome } from "./qualify";

// Automatic finding: every enabled feed source (Google Alerts set to RSS, or
// another public feed) is read every few hours by the server's cron. New
// items are saved as posts, checked and scored by AI (lib/growth/qualify.ts).
// Posts the quick check rejects are marked screened out: kept, so they aren't
// found and paid for again, but off the queue. Nothing is ever posted.
// Tested in discover.test.ts.

export const FEED_EVERY_HOURS = 6;
// Most new posts the AI scores per feed read; the rest wait for the next one.
export const MAX_SCORED_PER_RUN = 15;
// Older items aren't worth a reply (and a first read could pull in months).
const MAX_AGE_DAYS = 30;
const MAX_FEED_BYTES = 2_000_000;

export type DiscoverDeps = {
  fetchText?: (url: string) => Promise<string>;
  analyze?: (id: string) => Promise<QualifyOutcome>;
  now?: Date;
};

// A feed's text, politely: a clear name, a time limit, a size limit.
export async function fetchFeedText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "PhotoEZ-Growth/1.0 (+https://photoezcloud.com)", Accept: "application/atom+xml, application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`The feed answered ${response.status}.`);
  const text = await response.text();
  if (text.length > MAX_FEED_BYTES) throw new Error("The feed is too large.");
  return text;
}

type Source = typeof growthSources.$inferSelect;

// Reads one feed source now, saves what's new, and scores it.
export async function discoverSource(source: Source, deps: DiscoverDeps = {}) {
  const now = deps.now ?? new Date();
  const fetchText = deps.fetchText ?? fetchFeedText;
  const analyze = deps.analyze ?? ((id: string) => analyzeOpportunity(id));
  const [job] = await db.insert(growthJobRuns).values({ job: "discover:feed", sourceId: source.id, startedAt: now }).returning();
  // Marked as read up front, so the next cron tick doesn't start it twice.
  await db.update(growthSources).set({ lastRunAt: now }).where(eq(growthSources.id, source.id));

  try {
    const feedUrl = source.config.feedUrl;
    if (!feedUrl || !/^https:\/\//i.test(feedUrl)) throw new Error("This source has no https feed address.");
    const items = parseFeed(await fetchText(feedUrl));

    // A feed of every new thread (not a search) only keeps items about
    // business tools, by Elle's phrases and brand names.
    let wanted = items.filter((i) => !i.publishedAt || now.getTime() - i.publishedAt.getTime() < MAX_AGE_DAYS * 86_400_000);
    if (source.config.filter === "keywords") {
      const keywords = await db.select().from(growthKeywords).where(eq(growthKeywords.enabled, true));
      const phrases = keywords.filter((k) => k.group !== "negative").map((k) => k.phrase);
      const negatives = keywords.filter((k) => k.group === "negative").map((k) => k.phrase);
      wanted = wanted.filter((i) => matchesInterest(`${i.title} ${i.summary}`, phrases, negatives));
    }

    const savedIds: string[] = [];
    for (const item of wanted) {
      const result = await createOpportunity(
        {
          url: item.url,
          sourceId: source.id,
          title: item.title || null,
          excerpt: item.summary || item.title,
          authorLabel: null,
          publishedAt: item.publishedAt,
          kind: "sales_opportunity",
          externalId: item.id,
        },
        { evidence: `Found by ${source.name}` },
      );
      if ("id" in result && !result.duplicate) savedIds.push(result.id);
    }

    const kept = await scoreFound(savedIds, analyze);
    await db
      .update(growthJobRuns)
      .set({ status: "ok", finishedAt: new Date(), found: items.length, saved: savedIds.length, kept })
      .where(eq(growthJobRuns.id, job.id));
    return { found: items.length, saved: savedIds.length, kept };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    await db.update(growthJobRuns).set({ status: "error", finishedAt: new Date(), error: message }).where(eq(growthJobRuns.id, job.id));
    return { found: 0, saved: 0, kept: 0, error: message };
  }
}

// Scores found posts, up to the per-run limit; marks the ones the quick check
// rejects. Stops early when the month's budget runs out (they wait, unscored).
async function scoreFound(ids: string[], analyze: (id: string) => Promise<QualifyOutcome>) {
  let kept = 0;
  for (const id of ids.slice(0, MAX_SCORED_PER_RUN)) {
    const out = await analyze(id);
    if (out.status === "paused") break;
    if (out.status === "not_relevant") {
      await db.update(growthOpportunities).set({ screenedOut: true }).where(eq(growthOpportunities.id, id));
    } else if (out.status === "scored") kept++;
  }
  return kept;
}

// Found posts that missed scoring (over the per-run limit, or the budget ran
// out): picked up on later runs, oldest first.
async function catchUp(analyze: (id: string) => Promise<QualifyOutcome>) {
  const waiting = await db
    .select({ id: growthOpportunities.id })
    .from(growthOpportunities)
    .innerJoin(growthSources, eq(growthSources.id, growthOpportunities.sourceId))
    .where(and(ne(growthSources.kind, "manual"), isNull(growthOpportunities.score), eq(growthOpportunities.screenedOut, false)))
    .orderBy(asc(growthOpportunities.discoveredAt))
    .limit(MAX_SCORED_PER_RUN);
  return scoreFound(
    waiting.map((w) => w.id),
    analyze,
  );
}

// The cron's part: every feed due for a read, then any posts still waiting
// for a score.
export async function runDiscovery(deps: DiscoverDeps = {}) {
  const now = deps.now ?? new Date();
  const due = await db
    .select()
    .from(growthSources)
    .where(
      and(
        eq(growthSources.enabled, true),
        inArray(growthSources.kind, ["rss"]),
        or(isNull(growthSources.lastRunAt), lt(growthSources.lastRunAt, new Date(now.getTime() - FEED_EVERY_HOURS * 3_600_000))),
      ),
    );
  const results = [];
  for (const source of due) results.push({ source: source.name, ...(await discoverSource(source, deps)) });
  // Only alongside a feed read (every few hours), so a post whose scoring
  // keeps failing isn't retried, and paid for, every 15 minutes.
  const caughtUp = due.length ? await catchUp(deps.analyze ?? ((id: string) => analyzeOpportunity(id))) : 0;
  return { sources: results, caughtUp };
}
