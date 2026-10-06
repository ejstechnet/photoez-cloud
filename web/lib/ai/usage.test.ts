// Recording AI usage: every feature writes one row per call (or question),
// plan limits count exactly what they did before, recording never breaks a
// feature, and the backfill is safe to repeat. In-memory Postgres
// (test/db.ts) and stand-in clients; no Anthropic calls.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { and, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { aiUsage, inquiries, photos } from "@/db/schema";
import { addInquiry, callTools, makeStudio, reply, scriptedModel } from "../../test/assistant-fixtures.ts";
import { assistantAllowance, askAssistant } from "./assistant/run";
import { photoAllowance, tagNextPhotos } from "../gallery-tagging";
import { runTriage } from "../inquiries";
import { recordAiUsage } from "./usage";
import { backfillAiUsage } from "./usage-backfill";

const TRIAGE_USAGE = { input_tokens: 2000, output_tokens: 800, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const TRIAGE_RESULT = {
  summary: "Family session in May",
  clientName: "Dana",
  email: null,
  phone: null,
  sessionType: "family",
  sessionDetail: null,
  eventDate: null,
  dateText: null,
  location: null,
  budgetMin: null,
  budgetMax: null,
  budgetText: null,
  peopleCount: 4,
  questions: [],
  missingInfo: [],
  urgency: "normal",
  needsPhotographer: false,
  handoffReason: null,
  handoffNote: null,
  draftReply: "Hi Dana, thanks for reaching out!",
};

// A stand-in for client.beta.messages.parse.
function parseClient(reply: (n: number) => Record<string, unknown>) {
  let n = 0;
  return { beta: { messages: { parse: async () => reply(n++) } } } as unknown as Anthropic;
}
const triageClient = () =>
  parseClient(() => ({ model: "claude-opus-5", stop_reason: "end_turn", usage: TRIAGE_USAGE, parsed_output: TRIAGE_RESULT }));

const rowsFor = (photographerId: string) => db.select().from(aiUsage).where(eq(aiUsage.photographerId, photographerId));

// Makes every new ai_usage write fail (existing rows stay readable).
async function breakUsageWrites() {
  await db.execute(sql`alter table ai_usage add constraint usage_writes_off check (false) not valid`);
}
async function fixUsageWrites() {
  await db.execute(sql`alter table ai_usage drop constraint if exists usage_writes_off`);
}

async function addPhotos(galleryId: string, n: number) {
  return db
    .insert(photos)
    .values(Array.from({ length: n }, (_, i) => ({ galleryId, fileKey: `test/${galleryId}/${i}.jpg`, originalName: `IMG_${i}.jpg` })))
    .returning();
}
const thumb = () => sharp({ create: { width: 8, height: 8, channels: 3, background: "#808080" } }).jpeg().toBuffer();

test("triage writes one usage row: its tokens and cost, never counted toward a plan", async () => {
  const s = await makeStudio();
  const inquiry = await addInquiry(s.studio.id, "Hi, we'd love a family session in May.");
  await runTriage(inquiry, s.studio, { client: triageClient() });

  const [triaged] = await db.select().from(inquiries).where(eq(inquiries.id, inquiry.id));
  assert.ok(triaged.triagedAt, "the inquiry was triaged");
  // The inquiry still keeps its own tokens ("Triaged by … · N tokens").
  assert.equal(triaged.inputTokens, 2000);

  const rows = await rowsFor(s.studio.id);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.feature, "triage");
  assert.equal(row.model, "claude-opus-5");
  assert.equal(row.inquiryId, inquiry.id);
  assert.equal(row.countsTowardLimit, false);
  assert.equal(row.tokenSplitKnown, true);
  assert.equal(row.inputUncachedTokens, 2000);
  assert.equal(row.outputTokens, 800);
  // 2000 × $5 + 800 × $25 per million.
  assert.equal(row.costMicrodollars, 30_000);
  assert.equal(row.priceKey, "claude-opus-5@2025-01-01");
  assert.ok(row.latencyMs !== null && row.latencyMs >= 0);
});

test("a triage call that comes back cut off is still recorded", async () => {
  const s = await makeStudio();
  const inquiry = await addInquiry(s.studio.id, "Hello?");
  const quiet = console.error;
  console.error = () => {};
  await runTriage(inquiry, s.studio, {
    client: parseClient(() => ({ model: "claude-opus-5", stop_reason: "max_tokens", usage: TRIAGE_USAGE, parsed_output: null })),
  });
  console.error = quiet;
  const [triaged] = await db.select().from(inquiries).where(eq(inquiries.id, inquiry.id));
  assert.ok(triaged.triageError, "triage failed as before");
  const rows = await rowsFor(s.studio.id);
  assert.deepEqual(
    rows.map((r) => [r.feature, r.costMicrodollars]),
    [["triage", 30_000]],
  );
});

test("the Assistant writes one row per question with the split tokens and its trace", async () => {
  const s = await makeStudio();
  const model = scriptedModel([callTools([{ name: "studio_overview", input: {} }]), reply("All good.")]);
  const result = await askAssistant(s.studio.id, [], "How's the studio?", { client: model.client });
  assert.ok("answer" in result);
  const rows = await rowsFor(s.studio.id);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.feature, "assistant");
  assert.equal(row.traceId, result.traceId);
  assert.equal(row.countsTowardLimit, true);
  // Two model calls of 100 uncached + 20 cache writes + 50 cache reads + 30 out.
  assert.deepEqual([row.inputUncachedTokens, row.cacheWriteTokens, row.cacheReadTokens, row.outputTokens, row.inputTokens], [200, 40, 100, 60, 340]);
  // 200×2 + 40×2.5 + 100×0.2 + 60×10 (Sonnet 5)
  assert.equal(row.costMicrodollars, 1120);
});

test("photo tagging writes a row per photo; one that failed is recorded but doesn't count", async () => {
  const s = await makeStudio();
  await addPhotos(s.gallery.id, 3);
  const jpeg = await thumb();
  // The second photo's description comes back cut off.
  const client = parseClient((n) =>
    n === 1
      ? { model: "claude-haiku-4-5-20251001", stop_reason: "max_tokens", usage: { input_tokens: 790, output_tokens: 1024 }, parsed_output: null }
      : {
          model: "claude-haiku-4-5-20251001",
          stop_reason: "end_turn",
          usage: { input_tokens: 790, output_tokens: 91 },
          parsed_output: { description: "A family on a beach.", tags: ["family", "beach"] },
        },
  );
  const quiet = console.error;
  console.error = () => {};
  const done = await tagNextPhotos(s.gallery.id, s.studio.id, { client, readThumb: async () => jpeg });
  console.error = quiet;
  assert.deepEqual(done, { tagged: 2, failed: 1, remaining: 1 });

  const rows = await rowsFor(s.studio.id);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.feature === "photo_tag" && r.galleryId === s.gallery.id && r.costMicrodollars !== null));
  assert.equal(rows.filter((r) => r.countsTowardLimit).length, 2);
  // The plan counts the two photos that were described, as before.
  assert.equal((await photoAllowance(s.studio.id)).used, 2);
});

test("a model with no price is still recorded, with no cost", async () => {
  const s = await makeStudio();
  const warn = console.warn;
  console.warn = () => {};
  await recordAiUsage({
    feature: "assistant",
    photographerId: s.studio.id,
    model: "claude-mystery-9",
    tokens: { input: 10, cacheWrite: 0, cacheRead: 0, output: 5 },
    countsTowardLimit: true,
  });
  console.warn = warn;
  const [row] = await rowsFor(s.studio.id);
  assert.equal(row.model, "claude-mystery-9");
  assert.equal(row.inputTokens, 10);
  assert.equal(row.costMicrodollars, null);
  assert.equal(row.priceKey, null);
});

test("if usage can't be recorded, triage, the Assistant and tagging still work", async () => {
  const s = await makeStudio();
  const inquiry = await addInquiry(s.studio.id, "Do you do weddings?");
  await addPhotos(s.gallery.id, 1);
  const jpeg = await thumb();
  const quiet = console.error;
  console.error = () => {};
  await breakUsageWrites();
  try {
    await runTriage(inquiry, s.studio, { client: triageClient() });
    const [triaged] = await db.select().from(inquiries).where(eq(inquiries.id, inquiry.id));
    assert.ok(triaged.triagedAt);
    assert.equal(triaged.triageError, null);

    const model = scriptedModel([reply("Hello!")]);
    const answer = await askAssistant(s.studio.id, [], "Hi", { client: model.client });
    assert.ok("answer" in answer && answer.answer === "Hello!", JSON.stringify(answer));

    const tagged = await tagNextPhotos(s.gallery.id, s.studio.id, {
      client: parseClient(() => ({
        model: "claude-haiku-4-5",
        stop_reason: "end_turn",
        usage: { input_tokens: 790, output_tokens: 91 },
        parsed_output: { description: "A dog.", tags: ["dog"] },
      })),
      readThumb: async () => jpeg,
    });
    assert.deepEqual(tagged, { tagged: 1, failed: 0, remaining: 0 });
  } finally {
    await fixUsageWrites();
    console.error = quiet;
  }
  assert.equal((await rowsFor(s.studio.id)).length, 0, "nothing was recorded");
});

test("plan limits count exactly what they did before: Assistant questions and described photos only", async () => {
  const s = await makeStudio();
  const row = (feature: "assistant" | "photo_tag" | "triage" | "eval", countsTowardLimit: boolean, photographerId: string | null = s.studio.id) =>
    recordAiUsage({ feature, photographerId, model: "claude-sonnet-5", tokens: { input: 1, cacheWrite: 0, cacheRead: 0, output: 1 }, countsTowardLimit });
  // Before this change, only these rows existed: 3 questions, 2 described photos.
  for (let i = 0; i < 3; i++) await row("assistant", true);
  for (let i = 0; i < 2; i++) await row("photo_tag", true);
  // New kinds of rows that must not change the counts.
  await row("photo_tag", false);
  await row("triage", false);
  await row("triage", false);
  await row("eval", false, null);
  // An old-style row from before (no split, counts by default).
  await db.insert(aiUsage).values({ photographerId: s.studio.id, feature: "assistant", model: "claude-sonnet-5", inputTokens: 500, outputTokens: 50 });

  assert.equal((await assistantAllowance(s.studio.id)).used, 4);
  assert.equal((await photoAllowance(s.studio.id)).used, 2);
});

test("the backfill prices old rows as estimates and adds triaged inquiries, once", async () => {
  const s = await makeStudio();
  // An old Assistant row: cached and uncached input added together.
  const [old] = await db
    .insert(aiUsage)
    .values({ photographerId: s.studio.id, feature: "assistant", model: "claude-sonnet-5", inputTokens: 10_000, outputTokens: 600 })
    .returning();
  // An inquiry triaged before triage was recorded in ai_usage.
  const inquiry = await addInquiry(s.studio.id, "Engagement photos?");
  const triagedAt = new Date("2026-09-25T18:00:00Z");
  await db.update(inquiries).set({ model: "claude-opus-5", inputTokens: 2500, outputTokens: 850, triagedAt }).where(eq(inquiries.id, inquiry.id));
  // And one triaged after: it already has its row, so it's left alone.
  const recent = await addInquiry(s.studio.id, "Newborn session?");
  await runTriage(recent, s.studio, { client: triageClient() });

  const first = await backfillAiUsage();
  assert.ok(first.priced >= 1 && first.inquiries >= 1);
  const [priced] = await db.select().from(aiUsage).where(eq(aiUsage.id, old.id));
  assert.equal(priced.tokenSplitKnown, false);
  // Every input token at Sonnet 5's full price: 10000×2 + 600×10.
  assert.equal(priced.costMicrodollars, 26_000);

  const triageRows = await db.select().from(aiUsage).where(and(eq(aiUsage.photographerId, s.studio.id), eq(aiUsage.feature, "triage")));
  assert.equal(triageRows.length, 2);
  const backfilled = triageRows.find((r) => r.inquiryId === inquiry.id)!;
  assert.equal(backfilled.tokenSplitKnown, false);
  assert.equal(backfilled.countsTowardLimit, false);
  assert.equal(backfilled.createdAt.toISOString(), triagedAt.toISOString());
  assert.equal(backfilled.costMicrodollars, 33_750);

  // Running it again changes nothing.
  const before = await rowsFor(s.studio.id);
  await backfillAiUsage();
  const after = await rowsFor(s.studio.id);
  assert.equal(after.length, before.length);
  assert.deepEqual(
    after.map((r) => r.costMicrodollars).sort(),
    before.map((r) => r.costMicrodollars).sort(),
  );
});
