"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { giftCards } from "@/db/schema";
import { deliverGiftCard, newGiftCode } from "@/lib/gift-cards";
import { requirePhotographer } from "@/lib/session";

// The studio's gift card tools: issue a free card (giveaways, apologies,
// raffles), resend one, or void one. Each checks who is logged in.

export type IssueState = { message?: string; saved?: string; errors?: Record<string, string> };

const issueSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, "Enter a whole-dollar amount, like 100."),
  recipientName: z.string().trim().min(1, "Add their name.").max(80),
  recipientEmail: z.union([z.literal(""), z.email("Enter a valid email, or leave it blank.")]),
  message: z.string().trim().max(500),
});

export async function issueGiftCard(_prev: IssueState, formData: FormData): Promise<IssueState> {
  const photographer = await requirePhotographer();
  const parsed = issueSchema.safeParse({
    amount: String(formData.get("amount") ?? "").replace(/^\$/, ""),
    recipientName: String(formData.get("recipientName") ?? ""),
    recipientEmail: String(formData.get("recipientEmail") ?? "").trim(),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }
  const cents = Number(parsed.data.amount) * 100;
  if (cents <= 0) return { errors: { amount: "Enter an amount." } };
  const [card] = await db
    .insert(giftCards)
    .values({
      photographerId: photographer.id,
      code: await newGiftCode(),
      amountCents: cents,
      balanceCents: cents,
      status: "active",
      source: "issued",
      recipientName: parsed.data.recipientName,
      recipientEmail: parsed.data.recipientEmail || null,
      message: parsed.data.message || null,
    })
    .returning({ id: giftCards.id, code: giftCards.code });
  if (parsed.data.recipientEmail) await deliverGiftCard(card.id);
  revalidatePath("/dashboard/gift-cards");
  return {
    saved: parsed.data.recipientEmail
      ? `Gift card ${card.code} was emailed to ${parsed.data.recipientEmail}.`
      : `Gift card ${card.code} is ready to share.`,
  };
}

async function owned(cardId: string, photographerId: string) {
  if (!z.uuid().safeParse(cardId).success) return null;
  const [card] = await db
    .select()
    .from(giftCards)
    .where(and(eq(giftCards.id, cardId), eq(giftCards.photographerId, photographerId)));
  return card ?? null;
}

export async function resendGiftCard(cardId: string): Promise<{ message?: string }> {
  const photographer = await requirePhotographer();
  const card = await owned(cardId, photographer.id);
  if (!card || card.status !== "active") return { message: "That gift card can't be sent." };
  if (!card.recipientEmail) return { message: "This card has no email address to send to." };
  await deliverGiftCard(card.id);
  revalidatePath("/dashboard/gift-cards");
  return { message: `Sent to ${card.recipientEmail}.` };
}

// A voided card can't be used. Bookings already paid with it keep that amount.
export async function voidGiftCard(cardId: string): Promise<{ message?: string }> {
  const photographer = await requirePhotographer();
  const card = await owned(cardId, photographer.id);
  if (!card) return { message: "That gift card could not be found." };
  await db.update(giftCards).set({ status: "void" }).where(eq(giftCards.id, card.id));
  revalidatePath("/dashboard/gift-cards");
  return {};
}
