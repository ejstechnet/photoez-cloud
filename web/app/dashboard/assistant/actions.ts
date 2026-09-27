"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { assistantConversations, assistantProposals, bookings, clients, galleries } from "@/db/schema";
import { askAssistant, type ChatTurn } from "@/lib/ai/assistant/run";
import { conversationTitle, pruneConversations } from "@/lib/ai/assistant/history";
import type { Proposal } from "@/lib/ai/assistant/tools";
import { studioMessage, firstName } from "@/lib/email/messages";
import { emailBalanceReminder, emailGalleryExpiring, emailGalleryLink } from "@/lib/email/notify";
import { sendToClient } from "@/lib/email/send";
import { requestReview } from "@/lib/review-requests";
import { requirePhotographer } from "@/lib/session";
import { setBookingStatus } from "../bookings/actions";

// The Studio Assistant's dashboard actions: ask a question, and approve or
// dismiss what it prepared. Approving re-checks every id against the
// logged-in photographer before anything is sent or changed.

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
  await pruneConversations(photographer.id);
  revalidatePath("/dashboard/assistant");
  return { conversationId: id!, ...result };
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (!z.uuid().safeParse(conversationId).success) return;
  await db
    .delete(assistantConversations)
    .where(and(eq(assistantConversations.id, conversationId), eq(assistantConversations.photographerId, photographer.id)));
  revalidatePath("/dashboard/assistant");
}

const idList = z.array(z.uuid()).max(50);

export async function approveProposal(proposalId: string): Promise<{ result: string } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!z.uuid().safeParse(proposalId).success) return { error: "That card could not be found." };
  // Claim it first, so a double click can't run it twice.
  const [proposal] = await db
    .update(assistantProposals)
    .set({ status: "done", doneAt: new Date() })
    .where(
      and(
        eq(assistantProposals.id, proposalId),
        eq(assistantProposals.photographerId, photographer.id),
        eq(assistantProposals.status, "pending"),
      ),
    )
    .returning();
  if (!proposal) return { error: "This was already approved or dismissed." };

  const p = proposal.payload;
  let done = 0;
  let total = 0;
  try {
    if (proposal.kind === "client_email") {
      const clientIds = idList.parse(p.clientIds);
      const subject = z.string().min(1).max(150).parse(p.subject);
      const message = z.string().min(1).max(5000).parse(p.message);
      const rows = clientIds.length
        ? await db
            .select({ name: clients.name, email: clients.email })
            .from(clients)
            .where(and(eq(clients.photographerId, photographer.id), inArray(clients.id, clientIds)))
        : [];
      // New people become clients (unless one with that email already exists).
      const newPeople = z
        .array(z.object({ name: z.string().min(1).max(120), email: z.email() }))
        .max(20)
        .catch([])
        .parse(p.newRecipients);
      for (const person of newPeople) {
        const [existing] = await db
          .select({ name: clients.name, email: clients.email })
          .from(clients)
          .where(and(eq(clients.photographerId, photographer.id), sql`lower(${clients.email}) = ${person.email.toLowerCase()}`))
          .limit(1);
        if (existing) rows.push(existing);
        else {
          await db.insert(clients).values({ photographerId: photographer.id, name: person.name, email: person.email });
          rows.push(person);
        }
      }
      for (const r of rows) {
        if (!r.email) continue;
        total++;
        const body = message.replaceAll("{first_name}", firstName(r.name));
        if (await sendToClient(photographer.id, "assistant_email", r.email, studioMessage(subject, body))) done++;
      }
    } else if (proposal.kind === "gallery_emails") {
      const kind = z.enum(["link", "closing_soon", "review_request"]).parse(p.kind);
      const owned = await db
        .select({ id: galleries.id })
        .from(galleries)
        .where(and(eq(galleries.photographerId, photographer.id), inArray(galleries.id, idList.parse(p.galleryIds))));
      for (const { id } of owned) {
        total++;
        const ok =
          kind === "link"
            ? "ok" in (await emailGalleryLink(id))
            : kind === "closing_soon"
              ? await emailGalleryExpiring(id)
              : "ok" in (await requestReview(id));
        if (ok) done++;
      }
    } else if (proposal.kind === "balance_reminders") {
      const owned = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.photographerId, photographer.id), inArray(bookings.id, idList.parse(p.bookingIds))));
      for (const { id } of owned) {
        total++;
        if (await emailBalanceReminder(id)) done++;
      }
    } else if (proposal.kind === "booking_status") {
      const status = z.enum(["completed", "cancelled"]).parse(p.status);
      for (const id of idList.parse(p.bookingIds)) {
        total++;
        // setBookingStatus checks the booking is this photographer's.
        const result = await setBookingStatus(id, status);
        if (!result.message) done++;
      }
    }
  } catch (error) {
    console.error("Approving an assistant card failed", error);
  }

  const verb = proposal.kind === "booking_status" ? "Updated" : "Sent";
  const summary = !process.env.SMTP_HOST && proposal.kind !== "booking_status"
    ? `Done (${total}). Email isn't sent from this computer; see the Email log.`
    : `${verb} ${done} of ${total}.`;
  await db.update(assistantProposals).set({ result: summary }).where(eq(assistantProposals.id, proposal.id));
  revalidatePath("/dashboard", "layout");
  return { result: summary };
}

export async function dismissProposal(proposalId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (!z.uuid().safeParse(proposalId).success) return;
  await db
    .update(assistantProposals)
    .set({ status: "dismissed", doneAt: new Date() })
    .where(
      and(
        eq(assistantProposals.id, proposalId),
        eq(assistantProposals.photographerId, photographer.id),
        eq(assistantProposals.status, "pending"),
      ),
    );
}
