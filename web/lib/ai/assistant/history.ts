import { and, desc, eq, inArray, lt, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { assistantConversations, assistantProposals, type PROPOSAL_STATUSES, type ProposalDelivery } from "@/db/schema";
import { expireProposals } from "./executor";
import type { Proposal } from "./tools";

// Saved Studio Assistant conversations: the 10 most recent per photographer,
// each kept up to 90 days, so earlier answers can be looked up again.

export const KEEP_CONVERSATIONS = 10;
export const KEEP_DAYS = 90;

export type SavedTurn = { role: "user" | "assistant"; text: string; proposalIds?: string[] };
// A proposal as shown in a reopened conversation, with what happened to it.
export type SavedProposal = Proposal & { status: (typeof PROPOSAL_STATUSES)[number]; result: string | null; deliveries: ProposalDelivery[] | null };

export function conversationTitle(question: string) {
  const oneLine = question.replace(/\s+/g, " ").trim();
  return oneLine.length > 70 ? `${oneLine.slice(0, 67).trimEnd()}…` : oneLine;
}

// Drops conversations past the newest 10 or older than 90 days.
export async function pruneConversations(photographerId: string) {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  await db
    .delete(assistantConversations)
    .where(and(eq(assistantConversations.photographerId, photographerId), lt(assistantConversations.updatedAt, cutoff)));
  const newest = await db
    .select({ id: assistantConversations.id })
    .from(assistantConversations)
    .where(eq(assistantConversations.photographerId, photographerId))
    .orderBy(desc(assistantConversations.updatedAt))
    .limit(KEEP_CONVERSATIONS);
  if (newest.length === KEEP_CONVERSATIONS) {
    await db.delete(assistantConversations).where(
      and(
        eq(assistantConversations.photographerId, photographerId),
        notInArray(
          assistantConversations.id,
          newest.map((c) => c.id),
        ),
      ),
    );
  }
}

export async function recentConversations(photographerId: string) {
  await pruneConversations(photographerId);
  return db
    .select({ id: assistantConversations.id, title: assistantConversations.title, updatedAt: assistantConversations.updatedAt })
    .from(assistantConversations)
    .where(eq(assistantConversations.photographerId, photographerId))
    .orderBy(desc(assistantConversations.updatedAt))
    .limit(KEEP_CONVERSATIONS);
}

// One conversation, with its approval cards as they stand now.
export async function loadConversation(photographerId: string, conversationId: string) {
  const [conversation] = await db
    .select()
    .from(assistantConversations)
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.photographerId, photographerId)));
  if (!conversation) return null;
  // Cards past their 24 hours show as expired.
  await expireProposals(new Date(), photographerId);
  const proposalIds = conversation.turns.flatMap((t) => t.proposalIds ?? []);
  const rows = proposalIds.length
    ? await db
        .select()
        .from(assistantProposals)
        .where(and(eq(assistantProposals.photographerId, photographerId), inArray(assistantProposals.id, proposalIds)))
    : [];
  const proposals = new Map<string, SavedProposal>(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        kind: r.kind,
        summary: r.summary,
        details: Array.isArray(r.payload.details) ? (r.payload.details as string[]) : [],
        status: r.status,
        result: r.result,
        deliveries: r.deliveries,
      },
    ]),
  );
  return { conversation, proposals };
}
