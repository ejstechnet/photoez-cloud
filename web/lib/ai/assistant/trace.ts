import type Anthropic from "@anthropic-ai/sdk";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiTraceSteps, aiTraces, assistantProposals, AI_TRACE_OUTCOMES, AI_TRACE_STEP_TYPES } from "@/db/schema";

// Step logs for the Studio Assistant. Each answer gets a trace; every model
// call and tool call in it is a step, with what went in, what came back,
// how long it took, and the tokens. The loop (run.ts) wraps its model call
// in modelCall() and each tool in toolCall(), so this is the only place that
// records anything.
//
// A trace must never break the Assistant: every write is caught and logged,
// and if the trace row itself can't be saved, the rest are skipped.

// How long traces are kept; the cron job deletes older ones (pruneTraces).
export const AI_TRACE_KEEP_DAYS = Number(process.env.AI_TRACE_KEEP_DAYS) || 90;
// Tool inputs and outputs over this many characters are cut (truncated: true).
export const TRACE_FIELD_LIMIT = 10_000;

type Outcome = (typeof AI_TRACE_OUTCOMES)[number];
type StepType = (typeof AI_TRACE_STEP_TYPES)[number];
type StepStatus = "ok" | "error" | "refused";
type Tokens = { input: number; cacheRead: number; cacheWrite: number; output: number };

// A value as stored in a step: text over the limit is cut and marked.
export function capped(value: unknown): { value: unknown; truncated: boolean } {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  if (text.length <= TRACE_FIELD_LIMIT) return { value: value ?? null, truncated: false };
  return { value: `${text.slice(0, TRACE_FIELD_LIMIT)}… [cut: ${text.length} characters in all]`, truncated: true };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 2000);

export class Trace {
  readonly tokens: Tokens = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };
  private nextStep = 0;
  private readonly started = Date.now();

  // null when the trace row couldn't be saved; steps are then skipped.
  readonly id: string | null;
  readonly photographerId: string;

  private constructor(id: string | null, photographerId: string) {
    this.id = id;
    this.photographerId = photographerId;
  }

  static async start(o: { photographerId: string; feature: string; question: string; model: string }): Promise<Trace> {
    try {
      const [row] = await db
        .insert(aiTraces)
        .values({ photographerId: o.photographerId, feature: o.feature, question: o.question.slice(0, 2000), model: o.model })
        .returning({ id: aiTraces.id });
      return new Trace(row.id, o.photographerId);
    } catch (error) {
      console.error("Couldn't start an AI trace", error);
      return new Trace(null, o.photographerId);
    }
  }

  // Wraps one Claude call: times it and records its tokens and stop reason.
  async modelCall<T extends Anthropic.Message>(model: string, call: () => Promise<T>): Promise<T> {
    const index = this.nextStep++;
    const startedAt = new Date();
    try {
      const response = await call();
      const u = response.usage;
      const tokens = {
        inputTokens: u.input_tokens,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
        outputTokens: u.output_tokens,
      };
      this.tokens.input += tokens.inputTokens;
      this.tokens.cacheRead += tokens.cacheReadTokens;
      this.tokens.cacheWrite += tokens.cacheWriteTokens;
      this.tokens.output += tokens.outputTokens;
      await this.save(index, "model_call", startedAt, {
        model: response.model ?? model,
        stopReason: response.stop_reason,
        requestId: (response as { _request_id?: string | null })._request_id ?? null,
        ...tokens,
      });
      return response;
    } catch (error) {
      await this.save(index, "model_call", startedAt, { model, status: "error", error: message(error) });
      throw error;
    }
  }

  // Wraps one tool call: its input, what came back, and how long it took.
  // The step is numbered when the tool starts, so steps it records itself
  // (approval_requested) come after it.
  async toolCall<T extends { text: string }>(name: string, input: unknown, run: () => Promise<T>, statusOf?: (result: T) => StepStatus): Promise<T> {
    const index = this.nextStep++;
    const startedAt = new Date();
    try {
      const result = await run();
      await this.save(index, "tool_call", startedAt, { toolName: name, toolInput: input, toolOutput: result.text, status: statusOf?.(result) ?? "ok" });
      return result;
    } catch (error) {
      await this.save(index, "tool_call", startedAt, { toolName: name, toolInput: input, status: "error", error: message(error) });
      throw error;
    }
  }

  // Any other step (approval_requested, error).
  async step(type: StepType, fields: StepFields = {}) {
    await this.save(this.nextStep++, type, new Date(), fields);
  }

  async finish(outcome: Exclude<Outcome, "running">, error?: unknown) {
    if (!this.id) return;
    try {
      await db
        .update(aiTraces)
        .set({
          outcome,
          error: error === undefined ? null : message(error),
          inputTokens: this.tokens.input,
          cacheReadTokens: this.tokens.cacheRead,
          cacheWriteTokens: this.tokens.cacheWrite,
          outputTokens: this.tokens.output,
          endedAt: new Date(),
          latencyMs: Date.now() - this.started,
        })
        .where(eq(aiTraces.id, this.id));
    } catch (e) {
      console.error("Couldn't finish an AI trace", e);
    }
  }

  private async save(index: number, type: StepType, startedAt: Date, fields: StepFields) {
    if (!this.id) return;
    await insertStep(this.id, this.photographerId, index, type, startedAt, fields);
  }
}

type StepFields = {
  status?: StepStatus;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  model?: string;
  stopReason?: string | null;
  requestId?: string | null;
  inputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  outputTokens?: number;
  error?: string;
};

async function insertStep(traceId: string, photographerId: string, index: number | null, type: StepType, startedAt: Date, fields: StepFields) {
  const input = capped(fields.toolInput);
  const output = capped(fields.toolOutput);
  const endedAt = new Date();
  try {
    await db.insert(aiTraceSteps).values({
      traceId,
      photographerId,
      // null: after the last step so far (a decision made later).
      stepIndex: index ?? sql`(select coalesce(max(${aiTraceSteps.stepIndex}), -1) + 1 from ${aiTraceSteps} where ${aiTraceSteps.traceId} = ${traceId})`,
      stepType: type,
      ...fields,
      toolInput: fields.toolInput === undefined ? null : input.value,
      toolOutput: fields.toolOutput === undefined ? null : output.value,
      truncated: input.truncated || output.truncated,
      startedAt,
      endedAt,
      latencyMs: endedAt.getTime() - startedAt.getTime(),
    });
  } catch (error) {
    console.error("Couldn't save an AI trace step", type, error);
  }
}

// A step added after the answer finished: the photographer approving or
// dismissing a card. Scoped to the card's studio.
export async function addLateStep(traceId: string | null, photographerId: string, type: StepType, fields: StepFields = {}) {
  if (!traceId) return;
  await insertStep(traceId, photographerId, null, type, new Date(), fields);
}

// Once none of an answer's cards is waiting any more, its trace is completed.
export async function settleTrace(traceId: string | null) {
  if (!traceId) return;
  await db
    .update(aiTraces)
    .set({ outcome: "completed" })
    .where(
      and(
        eq(aiTraces.id, traceId),
        eq(aiTraces.outcome, "awaiting_approval"),
        sql`not exists (select 1 from ${assistantProposals} where ${assistantProposals.traceId} = ${traceId} and ${assistantProposals.status} = 'pending')`,
      ),
    )
    .catch((error) => console.error("Couldn't settle an AI trace", error));
}

// After the conversation is saved: which conversation and turn the trace
// answered.
export async function linkTrace(traceId: string | null, photographerId: string, conversationId: string, turnIndex: number) {
  if (!traceId) return;
  await db
    .update(aiTraces)
    .set({ conversationId, turnIndex })
    .where(and(eq(aiTraces.id, traceId), eq(aiTraces.photographerId, photographerId)))
    .catch((error) => console.error("Couldn't link an AI trace", error));
}

// Deletes traces (and their steps) older than AI_TRACE_KEEP_DAYS. Run by the cron job.
export async function pruneTraces(now = new Date(), days = AI_TRACE_KEEP_DAYS) {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const gone = await db.delete(aiTraces).where(lt(aiTraces.startedAt, cutoff)).returning({ id: aiTraces.id });
  return gone.length;
}
