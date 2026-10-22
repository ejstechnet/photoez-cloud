import { and, asc, desc, eq, ilike, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { growthAudit, growthFeatures, growthNotes, growthOpportunities, growthOutreach, growthSources, growthStatusEvents } from "@/db/schema";
import type { GROWTH_KINDS, GrowthStatus, GrowthTier } from "./constants";
import { CLOSED_STATUSES, effectiveScore, statusChangeProblem, tierFor } from "./pipeline";
import { growthSeeded, seedGrowth } from "./seed";
import { canonicalUrl, platformFromUrl } from "./urls";

// Reading and changing saved posts ("opportunities") for the owner-only
// Growth pages. Callers check requireOwner() first; nothing here touches
// studio data. Tested in opportunities.test.ts.

// The first visit to the Growth section loads the starting features,
// phrases and sources (lib/growth/seed.ts).
export async function ensureGrowthSeeded() {
  if (!(await growthSeeded())) await seedGrowth();
}

export const QUEUE_SORTS = ["newest", "score", "next_action"] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];

export type QueueFilters = {
  q?: string;
  // "active" (the default) hides closed and not-a-fit posts; "all" shows everything.
  status?: GrowthStatus | "active" | "all";
  tier?: GrowthTier | "unscored";
  sourceId?: string;
  sort?: QueueSort;
};

// The score that counts, as SQL: Elle's override, else the AI's.
const scoreSql = sql<number | null>`coalesce(${growthOpportunities.scoreOverride}, ${growthOpportunities.score})`;

export async function listOpportunities(filters: QueueFilters = {}) {
  const where: SQL[] = [];
  const q = filters.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(
      or(
        ilike(growthOpportunities.title, like),
        ilike(growthOpportunities.excerpt, like),
        ilike(growthOpportunities.url, like),
        ilike(growthOpportunities.authorLabel, like),
      )!,
    );
  }
  const status = filters.status ?? "active";
  if (status === "active") where.push(notInArray(growthOpportunities.status, [...CLOSED_STATUSES]));
  else if (status !== "all") where.push(eq(growthOpportunities.status, status));
  if (filters.tier === "unscored") where.push(sql`${scoreSql} is null`);
  else if (filters.tier) where.push(eq(growthOpportunities.tier, filters.tier));
  if (filters.sourceId) where.push(eq(growthOpportunities.sourceId, filters.sourceId));

  const order =
    filters.sort === "score"
      ? [sql`${scoreSql} desc nulls last`, desc(growthOpportunities.discoveredAt)]
      : filters.sort === "next_action"
        ? [sql`${growthOpportunities.nextActionAt} asc nulls last`, desc(growthOpportunities.discoveredAt)]
        : [desc(growthOpportunities.discoveredAt)];

  return db
    .select({
      id: growthOpportunities.id,
      url: growthOpportunities.url,
      platform: growthOpportunities.platform,
      title: growthOpportunities.title,
      excerpt: growthOpportunities.excerpt,
      authorLabel: growthOpportunities.authorLabel,
      status: growthOpportunities.status,
      score: scoreSql,
      tier: growthOpportunities.tier,
      kind: growthOpportunities.kind,
      discoveredAt: growthOpportunities.discoveredAt,
      nextActionAt: growthOpportunities.nextActionAt,
      sourceName: growthSources.name,
    })
    .from(growthOpportunities)
    .leftJoin(growthSources, eq(growthSources.id, growthOpportunities.sourceId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(...order)
    .limit(500);
}

// One post with its source, history (oldest first), notes and replies
// (newest first).
export async function getOpportunity(id: string) {
  const [post] = await db
    .select({ post: growthOpportunities, source: growthSources })
    .from(growthOpportunities)
    .leftJoin(growthSources, eq(growthSources.id, growthOpportunities.sourceId))
    .where(eq(growthOpportunities.id, id));
  if (!post) return null;
  const [events, notes, outreach] = await Promise.all([
    db.select().from(growthStatusEvents).where(eq(growthStatusEvents.opportunityId, id)).orderBy(asc(growthStatusEvents.createdAt)),
    db.select().from(growthNotes).where(eq(growthNotes.opportunityId, id)).orderBy(desc(growthNotes.createdAt)),
    db.select().from(growthOutreach).where(eq(growthOutreach.opportunityId, id)).orderBy(desc(growthOutreach.createdAt)),
  ]);
  return { ...post.post, source: post.source, events, notes, outreach };
}

// Feature names by key, for showing which ones the AI matched.
export async function featureNames(): Promise<Record<string, string>> {
  const rows = await db.select({ key: growthFeatures.key, name: growthFeatures.name }).from(growthFeatures);
  return Object.fromEntries(rows.map((r) => [r.key, r.name]));
}

export async function listSources() {
  return db.select().from(growthSources).orderBy(asc(growthSources.name));
}

export type NewOpportunity = {
  url: string;
  sourceId: string | null;
  title: string | null;
  excerpt: string;
  authorLabel: string | null;
  publishedAt: Date | null;
  kind: (typeof GROWTH_KINDS)[number];
};

// Saves a post, or points at the one already saved under the same link.
export async function createOpportunity(input: NewOpportunity): Promise<{ id: string; duplicate: boolean } | { error: string }> {
  const canonical = canonicalUrl(input.url);
  if (!canonical) return { error: "That doesn't look like a web link." };

  const [existing] = await db
    .select({ id: growthOpportunities.id })
    .from(growthOpportunities)
    .where(eq(growthOpportunities.canonicalUrl, canonical));
  if (existing) return { id: existing.id, duplicate: true };

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(growthOpportunities)
      .values({ ...input, url: input.url.trim(), canonicalUrl: canonical, platform: platformFromUrl(canonical) })
      .onConflictDoNothing({ target: growthOpportunities.canonicalUrl })
      .returning({ id: growthOpportunities.id });
    // Saved by someone else a moment ago (two tabs): use that one.
    if (!row) {
      const [again] = await tx
        .select({ id: growthOpportunities.id })
        .from(growthOpportunities)
        .where(eq(growthOpportunities.canonicalUrl, canonical));
      return { id: again.id, duplicate: true };
    }
    await tx.insert(growthStatusEvents).values({ opportunityId: row.id, fromStatus: null, toStatus: "new", evidence: "Saved" });
    return { id: row.id, duplicate: false };
  });
}

// Moves a post along the pipeline and records why. Returns a problem to show
// instead when the move isn't allowed.
export async function changeStatus(id: string, to: GrowthStatus, evidence: string | null): Promise<string | null> {
  const [post] = await db.select({ status: growthOpportunities.status }).from(growthOpportunities).where(eq(growthOpportunities.id, id));
  if (!post) return "That post is gone.";
  const problem = statusChangeProblem(post.status, to, evidence);
  if (problem) return problem;

  await db.transaction(async (tx) => {
    await tx.update(growthOpportunities).set({ status: to, updatedAt: new Date() }).where(eq(growthOpportunities.id, id));
    await tx.insert(growthStatusEvents).values({ opportunityId: id, fromStatus: post.status, toStatus: to, evidence: evidence?.trim() || null });
  });
  return null;
}

export async function addNote(id: string, body: string) {
  await db.insert(growthNotes).values({ opportunityId: id, body: body.trim() });
}

// Elle's own score (or null to go back to the AI's), with the tier to match.
export async function setScoreOverride(id: string, override: number | null, reason: string | null) {
  const [post] = await db.select({ score: growthOpportunities.score }).from(growthOpportunities).where(eq(growthOpportunities.id, id));
  if (!post) return;
  await db
    .update(growthOpportunities)
    .set({
      scoreOverride: override,
      overrideReason: override === null ? null : reason?.trim() || null,
      tier: tierFor(effectiveScore(post.score, override)),
      updatedAt: new Date(),
    })
    .where(eq(growthOpportunities.id, id));
}

export async function setNextAction(id: string, at: Date | null) {
  await db.update(growthOpportunities).set({ nextActionAt: at, updatedAt: new Date() }).where(eq(growthOpportunities.id, id));
}

// Deletes a post and everything about it (analyses, notes, history and
// replies go with it), keeping a record that it happened.
export async function deleteOpportunity(id: string) {
  const [gone] = await db
    .delete(growthOpportunities)
    .where(eq(growthOpportunities.id, id))
    .returning({ id: growthOpportunities.id, platform: growthOpportunities.platform });
  if (gone) await db.insert(growthAudit).values({ action: "delete", entityId: gone.id, details: { platform: gone.platform } });
}

export async function recordExport(rows: number) {
  await db.insert(growthAudit).values({ action: "export_csv", details: { rows } });
}
