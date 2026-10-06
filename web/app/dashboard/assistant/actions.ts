"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { assistantConversations, assistantProposals, photographers } from "@/db/schema";
import { approveAndRun, decideAction, retryAndRun, type ActionEffects, type CardOutcome } from "@/lib/ai/assistant/executor";
import { askAssistant, type ChatTurn } from "@/lib/ai/assistant/run";
import { conversationTitle, pruneConversations } from "@/lib/ai/assistant/history";
import { linkTrace } from "@/lib/ai/assistant/trace";
import type { Proposal } from "@/lib/ai/assistant/tools";
import { studioMessage } from "@/lib/email/messages";
import { emailBalanceReminder, emailGalleryExpiring, emailGalleryLink } from "@/lib/email/notify";
import { sendToClient } from "@/lib/email/send";
import { requestReview } from "@/lib/review-requests";
import { requirePhotographer } from "@/lib/session";
import { setBookingStatus } from "../bookings/actions";

// The Studio Assistant's dashboard actions: ask a question, and approve or
// dismiss what it prepared. Approving goes through lib/ai/assistant/executor.ts,
// which re-checks everything against the logged-in photographer and runs
// each card at most once.

// What an approved card may actually do. Without SMTP (a developer's
// computer) emails are only written to the Email log, which counts as done.
const logged = (sent: boolean) => sent || !process.env.SMTP_HOST;
const effects: ActionEffects = {
  emailClient: async (photographerId, to, subject, body) =>
    logged(await sendToClient(photographerId, "assistant_email", to.email, studioMessage(subject, body))),
  galleryEmail: async (kind, galleryId) =>
    kind === "link"
      ? "ok" in (await emailGalleryLink(galleryId))
      : kind === "closing_soon"
        ? logged(await emailGalleryExpiring(galleryId))
        : "ok" in (await requestReview(galleryId)),
  balanceReminder: async (bookingId) => logged(await emailBalanceReminder(bookingId)),
  // setBookingStatus checks the booking is this photographer's.
  bookingStatus: async (bookingId, status) => !(await setBookingStatus(bookingId, status)).message,
};

export async function ask(
  conversationId: string | null,
  question: string,
): Promise<{ conversationId: string; answer: string; proposals: Proposal[] } | { error: string }> {
  const photographer = await requirePhotographer();
  const q = question.trim().slice(0, 2000);
  if (!q) return { error: "Ask me something about your studio." };

  // The earlier turns come from the saved conversation, never from the browser.
  let conversation: typeof assistantConversations.$inferSelect | null = null;
  if (conversationId) {
    if (!z.uuid().safeParse(conversationId).success) return { error: "That conversation could not be found." };
    [conversation] = await db
      .select()
      .from(assistantConversations)
      .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.photographerId, photographer.id)));
    if (!conversation) return { error: "That conversation was deleted or has expired. Start a new chat." };
  }
  const history: ChatTurn[] = (conversation?.turns ?? []).map((t) => ({ role: t.role, text: t.text }));
  const result = await askAssistant(photographer.id, history, q);
  if ("error" in result) return result;

  const turns = [
    ...(conversation?.turns ?? []),
    { role: "user" as const, text: q },
    { role: "assistant" as const, text: result.answer, proposalIds: result.proposals.map((p) => p.id) },
  ];
  let id = conversation?.id;
  if (id) {
    await db.update(assistantConversations).set({ turns, updatedAt: new Date() }).where(eq(assistantConversations.id, id));
  } else {
    [{ id }] = await db
      .insert(assistantConversations)
      .values({ photographerId: photographer.id, title: conversationTitle(q), turns })
      .returning({ id: assistantConversations.id });
  }
  // Tie the trace and the cards to this conversation and question.
  await linkTrace(result.traceId, photographer.id, id!, turns.length - 2);
  if (result.proposals.length) {
    await db
      .update(assistantProposals)
      .set({ conversationId: id! })
      .where(and(eq(assistantProposals.photographerId, photographer.id), inArray(assistantProposals.id, result.proposals.map((p) => p.id))));
  }
  await pruneConversations(photographer.id);
  revalidatePath("/dashboard/assistant");
  return { conversationId: id!, answer: result.answer, proposals: result.proposals };
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (!z.uuid().safeParse(conversationId).success) return;
  await db
    .delete(assistantConversations)
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.photographerId, photographer.id)));
  revalidatePath("/dashboard/assistant");
}

export async function approveProposal(proposalId: string): Promise<CardOutcome> {
  const photographer = await requirePhotographer();
  const [studio] = await db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, photographer.id));
  const outcome = await approveAndRun(proposalId, photographer.id, studio.timeZone, effects);
  revalidatePath("/dashboard", "layout");
  return outcome;
}

// "Try again" on a card that stopped part way: only the people who didn't get it.
export async function retryProposal(proposalId: string): Promise<CardOutcome> {
  const photographer = await requirePhotographer();
  const [studio] = await db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, photographer.id));
  const outcome = await retryAndRun(proposalId, photographer.id, studio.timeZone, effects);
  revalidatePath("/dashboard", "layout");
  return outcome;
}

export async function dismissProposal(proposalId: string): Promise<void> {
  const photographer = await requirePhotographer();
  await decideAction(proposalId, photographer.id, "dismiss");
}
