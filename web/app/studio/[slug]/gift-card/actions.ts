"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { giftCards, photographers } from "@/db/schema";
import { localDateOf } from "@/lib/booking/time";
import { checkGiftAmount } from "@/lib/gift-card-rules";
import { newGiftCode, startGiftCardCheckout } from "@/lib/gift-cards";
import { paymentAccount } from "@/lib/payments/checkout";
import { overLimit } from "@/lib/rate-limit";

export type GiftFormState = { message?: string; errors?: Record<string, string> };

const formSchema = z.object({
  amountCents: z.number().int(),
  recipientName: z.string().trim().min(1, "Add their name.").max(80),
  recipientEmail: z.email("Enter their email address."),
  message: z.string().trim().max(500, "Keep the message under 500 characters."),
  deliverOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  buyerName: z.string().trim().min(1, "Add your name.").max(80),
  buyerEmail: z.email("Enter your email address."),
});

// A gift card purchase from the studio page: the card is saved (waiting on
// payment), then the buyer goes to Stripe Checkout on the studio's account.
export async function buyGiftCard(slug: string, _prev: GiftFormState, formData: FormData): Promise<GiftFormState> {
  if (String(formData.get("website") ?? "") !== "") return { message: "Something went wrong. Please try again." };
  if (await overLimit("gift-card", 10, 60 * 60 * 1000)) return { message: "Too many tries from here. Please wait a little and try again." };
  const [studio] = await db.select().from(photographers).where(eq(photographers.studioSlug, slug.toLowerCase()));
  if (!studio || !studio.giftCardsEnabled) return { message: "Gift cards aren't available right now." };
  const account = await paymentAccount(studio.id);
  if (!account) return { message: "Online payment isn't available right now. Please contact the studio." };

  const custom = String(formData.get("customAmount") ?? "").replace(/[$,\s]/g, "");
  const choice = String(formData.get("amount") ?? "");
  const amountCents = choice === "custom" ? Math.round(Number(custom) * 100) : Number(choice);
  const parsed = formSchema.safeParse({
    amountCents,
    recipientName: String(formData.get("recipientName") ?? ""),
    recipientEmail: String(formData.get("recipientEmail") ?? "").trim(),
    message: String(formData.get("message") ?? ""),
    deliverOn: String(formData.get("deliverOn") ?? ""),
    buyerName: String(formData.get("buyerName") ?? ""),
    buyerEmail: String(formData.get("buyerEmail") ?? "").trim(),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors, message: "Please check the highlighted fields." };
  }
  const data = parsed.data;
  const amountError = checkGiftAmount(data.amountCents, {
    amounts: studio.giftCardAmounts,
    minCents: studio.giftCardMinCents,
    maxCents: studio.giftCardMaxCents,
  });
  if (amountError) return { errors: { amount: amountError }, message: amountError };

  // A delivery day in the past (or today) just means "send it now".
  const today = localDateOf(new Date(), studio.timeZone);
  const deliverOn = data.deliverOn && data.deliverOn > today ? data.deliverOn : null;

  const [card] = await db
    .insert(giftCards)
    .values({
      photographerId: studio.id,
      code: await newGiftCode(),
      amountCents: data.amountCents,
      balanceCents: data.amountCents,
      buyerName: data.buyerName,
      buyerEmail: data.buyerEmail,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      message: data.message || null,
      deliverOn,
    })
    .returning({ id: giftCards.id });

  let url: string | null = null;
  try {
    url = await startGiftCardCheckout({
      cardId: card.id,
      slug: slug.toLowerCase(),
      studioName: studio.businessName || studio.name,
      account,
      amountCents: data.amountCents,
      recipientName: data.recipientName,
    });
  } catch (error) {
    console.error("Stripe Checkout failed", error);
  }
  if (!url) {
    await db.update(giftCards).set({ status: "void" }).where(eq(giftCards.id, card.id));
    return { message: "Online payment isn't available right now. Please try again in a minute." };
  }
  redirect(url);
}
