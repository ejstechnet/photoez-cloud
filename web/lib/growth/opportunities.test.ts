// Saving and moving posts in the Growth queue. Runs against the in-memory
// Postgres (test/db.ts).   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { growthAudit, growthOpportunities, growthSources } from "@/db/schema";
import {
  addNote,
  changeStatus,
  createOpportunity,
  deleteOpportunity,
  ensureGrowthSeeded,
  getOpportunity,
  listOpportunities,
  setScoreOverride,
} from "./opportunities";

const post = (url: string, excerpt = "Anyone switched from Pixieset? The fees are killing me.") => ({
  url,
  sourceId: null,
  title: null,
  excerpt,
  authorLabel: null,
  publishedAt: null,
  kind: "sales_opportunity" as const,
});

test("the first visit loads the starting data once", async () => {
  await ensureGrowthSeeded();
  await ensureGrowthSeeded();
  const sources = await db.select().from(growthSources);
  // The two starting sources, plus Elle's Facebook search (migration 0062).
  assert.deepEqual(sources.map((s) => s.name).sort(), [
    "Facebook search: how do you deliver photos to clients",
    "Manual capture",
    "My main photography Facebook group",
  ]);
  const search = sources.find((s) => s.name.startsWith("Facebook search"));
  assert.match(search?.config.searchUrl ?? "", /^https:\/\/www\.facebook\.com\/search\/top\?q=how%20do%20you%20deliver%20photos%20to%20clients/);
});

test("a post is saved once, however its link is written", async () => {
  const first = await createOpportunity(post("https://m.facebook.com/groups/9/posts/1/?mibextid=x"));
  assert.ok("id" in first && !first.duplicate);
  const again = await createOpportunity(post("https://www.facebook.com/groups/9/posts/1#c"));
  assert.ok("id" in again && again.duplicate);
  assert.equal(again.id, first.id);

  const saved = await getOpportunity(first.id);
  assert.equal(saved?.platform, "facebook");
  assert.equal(saved?.canonicalUrl, "https://www.facebook.com/groups/9/posts/1");
  assert.deepEqual(
    saved?.events.map((e) => [e.fromStatus, e.toStatus]),
    [[null, "new"]],
  );

  assert.deepEqual(await createOpportunity(post("ftp://nope")), { error: "That doesn't look like a web link." });
});

test("moves are recorded with evidence, and late stages refuse to move without it", async () => {
  const made = await createOpportunity(post("https://www.reddit.com/r/photography/comments/zz/gallery_apps"));
  assert.ok("id" in made);
  assert.equal(await changeStatus(made.id, "engaged", null), null);
  assert.match((await changeStatus(made.id, "responded", "")) ?? "", /Say what happened/);
  assert.equal(await changeStatus(made.id, "responded", "Asked if proofing has a selection limit"), null);
  await addNote(made.id, "  Shoots seniors in Ohio  ");

  const saved = await getOpportunity(made.id);
  assert.equal(saved?.status, "responded");
  assert.deepEqual(
    saved?.events.map((e) => e.toStatus),
    ["new", "engaged", "responded"],
  );
  assert.equal(saved?.events.at(-1)?.evidence, "Asked if proofing has a selection limit");
  assert.equal(saved?.notes[0].body, "Shoots seniors in Ohio");
});

test("Elle's score sets the tier, and the queue filters, searches and sorts", async () => {
  const a = await createOpportunity(post("https://example.com/forum/1", "Need booking and contracts in one place"));
  const b = await createOpportunity(post("https://example.com/forum/2", "Which lens for portraits?"));
  assert.ok("id" in a && "id" in b);
  await setScoreOverride(a.id, 85, "Asked for a recommendation outright");
  await setScoreOverride(b.id, 20, null);
  const [row] = await db.select().from(growthOpportunities).where(eq(growthOpportunities.id, a.id));
  assert.equal(row.tier, "high");
  assert.equal(row.overrideReason, "Asked for a recommendation outright");

  const high = await listOpportunities({ tier: "high" });
  assert.deepEqual(
    high.map((r) => r.id),
    [a.id],
  );
  const searched = await listOpportunities({ q: "contracts" });
  assert.deepEqual(
    searched.map((r) => r.id),
    [a.id],
  );
  const byScore = await listOpportunities({ sort: "score" });
  assert.deepEqual(
    byScore.slice(0, 2).map((r) => r.score),
    [85, 20],
  );

  // A post marked "not a fit" leaves the queue but is still there under "all".
  assert.equal(await changeStatus(b.id, "not_qualified", null), null);
  assert.ok(!(await listOpportunities()).some((r) => r.id === b.id));
  assert.ok((await listOpportunities({ status: "all" })).some((r) => r.id === b.id));

  // Going back to the AI's score (none yet) clears the tier.
  await setScoreOverride(a.id, null, "ignored");
  const [cleared] = await db.select().from(growthOpportunities).where(eq(growthOpportunities.id, a.id));
  assert.equal(cleared.tier, null);
  assert.equal(cleared.overrideReason, null);
});

test("deleting a post removes it and leaves a record", async () => {
  const made = await createOpportunity(post("https://example.com/forum/delete-me"));
  assert.ok("id" in made);
  await deleteOpportunity(made.id);
  assert.equal(await getOpportunity(made.id), null);
  const audit = await db.select().from(growthAudit).where(eq(growthAudit.entityId, made.id));
  assert.equal(audit[0]?.action, "delete");
});
