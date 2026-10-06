// Studio Assistant step logs: every model call and tool call is recorded in
// order with its tokens, and a broken log never breaks an answer. In-memory
// Postgres (test/db.ts) and a scripted model; no Anthropic calls.
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiTraces, aiTraceSteps, aiUsage } from "@/db/schema";
import { callTools, makeStudio, reply, scriptedModel, USAGE } from "../../../test/assistant-fixtures.ts";
import { askAssistant } from "./run";
import { capped, pruneTraces, TRACE_FIELD_LIMIT } from "./trace";

test("a turn with two tool calls is traced step by step, with tokens split", async () => {
  const s = await makeStudio();
  const model = scriptedModel([
    callTools([
      { name: "studio_overview", input: {} },
      { name: "find_clients", input: { search: "Ana" } },
    ]),
    reply("You have 2 clients; Ana Lopez is one."),
  ]);
  const result = await askAssistant(s.studio.id, [], "Who is Ana?", { client: model.client });
  assert.ok("answer" in result && result.traceId, JSON.stringify(result));

  const [trace] = await db.select().from(aiTraces).where(eq(aiTraces.id, result.traceId));
  assert.equal(trace.outcome, "completed");
  assert.equal(trace.question, "Who is Ana?");
  assert.equal(trace.photographerId, s.studio.id);
  // Two model calls' worth, each kind kept separate.
  assert.equal(trace.inputTokens, 2 * USAGE.input_tokens);
  assert.equal(trace.cacheReadTokens, 2 * USAGE.cache_read_input_tokens);
  assert.equal(trace.cacheWriteTokens, 2 * USAGE.cache_creation_input_tokens);
  assert.equal(trace.outputTokens, 2 * USAGE.output_tokens);
  assert.ok(trace.endedAt && trace.latencyMs !== null && trace.latencyMs >= 0);

  const steps = await db.select().from(aiTraceSteps).where(eq(aiTraceSteps.traceId, trace.id)).orderBy(asc(aiTraceSteps.stepIndex));
  assert.deepEqual(
    steps.map((st) => [st.stepIndex, st.stepType, st.toolName]),
    [
      [0, "model_call", null],
      [1, "tool_call", "studio_overview"],
      [2, "tool_call", "find_clients"],
      [3, "model_call", null],
    ],
  );
  for (const st of steps) {
    assert.equal(st.photographerId, s.studio.id);
    assert.equal(st.status, "ok");
    assert.ok(st.latencyMs !== null && st.endedAt);
  }
  const [first] = steps;
  assert.equal(first.stopReason, "tool_use");
  assert.equal(first.inputTokens, USAGE.input_tokens);
  assert.equal(first.cacheReadTokens, USAGE.cache_read_input_tokens);
  assert.equal(first.cacheWriteTokens, USAGE.cache_creation_input_tokens);
  assert.equal(first.outputTokens, USAGE.output_tokens);
  assert.deepEqual(steps[2].toolInput, { search: "Ana" });
  assert.match(JSON.stringify(steps[2].toolOutput), /Ana Lopez/);
  assert.equal(steps[3].stopReason, "end_turn");

  // Plan limits still see one row per question, with every input token counted.
  const usage = await db.select().from(aiUsage).where(eq(aiUsage.photographerId, s.studio.id));
  assert.equal(usage.length, 1);
  assert.equal(usage[0].inputTokens, 2 * (USAGE.input_tokens + USAGE.cache_read_input_tokens + USAGE.cache_creation_input_tokens));
});

test("a failing tool is recorded as an error step and the answer still comes back", async () => {
  const s = await makeStudio();
  const model = scriptedModel([callTools([{ name: "made_up_tool", input: {} }]), reply("I couldn't look that up.")]);
  const result = await askAssistant(s.studio.id, [], "Do something odd", { client: model.client });
  assert.ok("answer" in result && result.traceId);
  const steps = await db.select().from(aiTraceSteps).where(eq(aiTraceSteps.traceId, result.traceId)).orderBy(asc(aiTraceSteps.stepIndex));
  assert.equal(steps[1].toolName, "made_up_tool");
  assert.equal(steps[1].status, "error");
  assert.ok(steps[1].error);
});

test("a model error marks the trace as an error", async () => {
  const s = await makeStudio();
  const client = {
    messages: {
      create: async () => {
        throw new Error("overloaded");
      },
    },
  };
  const result = await askAssistant(s.studio.id, [], "Hello?", { client });
  assert.ok("error" in result);
  const [trace] = await db.select().from(aiTraces).where(eq(aiTraces.photographerId, s.studio.id));
  assert.equal(trace.outcome, "error");
  assert.match(trace.error ?? "", /overloaded/);
});

test("if the step log can't be written, the assistant still answers", async () => {
  const s = await makeStudio();
  const quiet = console.error;
  console.error = () => {};
  try {
    // Steps can't be saved.
    await db.execute(sql`alter table ai_trace_steps rename to ai_trace_steps_hidden`);
    const one = await askAssistant(s.studio.id, [], "Overview please", {
      client: scriptedModel([callTools([{ name: "studio_overview", input: {} }]), reply("All quiet this week.")]).client,
    });
    assert.ok("answer" in one, JSON.stringify(one));
    assert.equal(one.answer, "All quiet this week.");
    await db.execute(sql`alter table ai_trace_steps_hidden rename to ai_trace_steps`);

    // Not even the trace can be saved.
    await db.execute(sql`alter table ai_traces rename to ai_traces_hidden`);
    const two = await askAssistant(s.studio.id, [], "Overview again", {
      client: scriptedModel([callTools([{ name: "studio_overview", input: {} }]), reply("Still quiet.")]).client,
    });
    assert.ok("answer" in two, JSON.stringify(two));
    assert.equal(two.answer, "Still quiet.");
    assert.equal(two.traceId, null);
  } finally {
    await db.execute(sql`alter table if exists ai_trace_steps_hidden rename to ai_trace_steps`);
    await db.execute(sql`alter table if exists ai_traces_hidden rename to ai_traces`);
    console.error = quiet;
  }
});

test("big tool outputs are cut at about 10 KB and marked", () => {
  assert.deepEqual(capped("short"), { value: "short", truncated: false });
  const big = capped("x".repeat(TRACE_FIELD_LIMIT + 500));
  assert.equal(big.truncated, true);
  assert.ok(String(big.value).length < TRACE_FIELD_LIMIT + 100);
  assert.match(String(big.value), /cut: 10500 characters/);
});

test("traces older than the retention period are deleted with their steps", async () => {
  const s = await makeStudio();
  const [old] = await db
    .insert(aiTraces)
    .values({ photographerId: s.studio.id, feature: "assistant", question: "old", model: "m", startedAt: new Date(Date.now() - 91 * 86_400_000) })
    .returning();
  await db.insert(aiTraceSteps).values({ traceId: old.id, photographerId: s.studio.id, stepIndex: 0, stepType: "model_call" });
  const [recent] = await db.insert(aiTraces).values({ photographerId: s.studio.id, feature: "assistant", question: "new", model: "m" }).returning();

  assert.ok((await pruneTraces(new Date(), 90)) >= 1);
  assert.equal((await db.select().from(aiTraces).where(eq(aiTraces.id, old.id))).length, 0);
  assert.equal((await db.select().from(aiTraceSteps).where(eq(aiTraceSteps.traceId, old.id))).length, 0);
  assert.equal((await db.select().from(aiTraces).where(eq(aiTraces.id, recent.id))).length, 1);
});
