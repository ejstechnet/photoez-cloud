// Test data and stand-ins for the Studio Assistant tests: a studio with
// clients, galleries and bookings in the test database (test/db.ts), a
// scripted "model" that replies exactly as a test says, and effects that
// only count what they were asked to do. Nothing here calls Anthropic or
// sends anything.
import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "./db.ts";
import { bookings, clients, galleries, inquiries, photographers } from "../db/schema.ts";
import type { ActionEffects } from "../lib/ai/assistant/executor.ts";

export async function makeStudio(name = "Test Studio") {
  const [studio] = await db
    .insert(photographers)
    .values({ name, email: `${randomUUID()}@example.test`, plan: "studio", timeZone: "America/Los_Angeles" })
    .returning();
  const ctx = { photographerId: studio.id, timeZone: studio.timeZone };

  const people = await db
    .insert(clients)
    .values([
      { photographerId: studio.id, name: "Ana Lopez", email: "ana@example.test" },
      { photographerId: studio.id, name: "Ben Ross", email: "ben@example.test" },
    ])
    .returning();
  const [gallery] = await db
    .insert(galleries)
    .values({
      photographerId: studio.id,
      clientId: people[0].id,
      title: "Lopez Family",
      shareToken: randomUUID(),
      status: "delivered",
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    })
    .returning();
  // Distinct times per studio (bookings can't overlap).
  const start = new Date(Date.now() + (10 + Math.floor(Math.random() * 300)) * 24 * 60 * 60 * 1000);
  const [booking] = await db
    .insert(bookings)
    .values({
      photographerId: studio.id,
      clientId: people[1].id,
      sessionName: "Mini session",
      priceCents: 20000,
      depositPercent: 25,
      startsAt: start,
      endsAt: new Date(start.getTime() + 60 * 60 * 1000),
      status: "confirmed",
      clientName: "Ben Ross",
      clientEmail: "ben@example.test",
      manageToken: randomUUID(),
    })
    .returning();
  return { studio, ctx, clients: people, gallery, booking };
}

export async function addInquiry(photographerId: string, message: string) {
  const [row] = await db.insert(inquiries).values({ photographerId, message, fromName: "Stranger", fromEmail: "stranger@example.test" }).returning();
  return row;
}

// Effects that record calls instead of sending email or changing bookings.
export function spyEffects() {
  const calls: string[] = [];
  const effects: ActionEffects = {
    emailClient: async (_studio, to) => (calls.push(`email ${to.email}`), true),
    galleryEmail: async (kind, id) => (calls.push(`gallery ${kind} ${id}`), true),
    balanceReminder: async (id) => (calls.push(`balance ${id}`), true),
    bookingStatus: async (id, status) => (calls.push(`booking ${id} ${status}`), true),
  };
  return { effects, calls };
}

// ---- A scripted model -------------------------------------------------------

export const USAGE = { input_tokens: 100, output_tokens: 30, cache_read_input_tokens: 50, cache_creation_input_tokens: 20 };

function message(content: Anthropic.ContentBlock[], stop: Anthropic.StopReason): Anthropic.Message {
  return {
    id: `msg_${randomUUID()}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { ...USAGE },
  } as unknown as Anthropic.Message;
}

export const reply = (text: string) => message([{ type: "text", text, citations: null } as Anthropic.TextBlock], "end_turn");

export const callTools = (calls: { name: string; input: Record<string, unknown> }[], text = "") =>
  message(
    [
      ...(text ? [{ type: "text", text, citations: null } as Anthropic.TextBlock] : []),
      ...calls.map((c) => ({ type: "tool_use", id: `toolu_${randomUUID()}`, name: c.name, input: c.input }) as Anthropic.ToolUseBlock),
    ],
    "tool_use",
  );

// Replies in order; records what the loop sent each time.
export function scriptedModel(replies: Anthropic.Message[]) {
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  return {
    requests,
    client: {
      messages: {
        create: async (params: Anthropic.MessageCreateParamsNonStreaming) => {
          requests.push(structuredClone(params));
          const next = replies.shift();
          if (!next) throw new Error("The scripted model ran out of replies.");
          return next;
        },
      },
    },
  };
}
