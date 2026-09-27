import { randomBytes } from "node:crypto";
import { and, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, giftCards, payments, photographers } from "@/db/schema";
import { localDateOf, formatDate } from "@/lib/booking/time";
import { giftCardRecipient, giftCardReceipt, giftCardSoldStudio, type GiftCardFacts } from "@/lib/email/messages";
import { sendToClient, sendToStudio } from "@/lib/email/send";
import { giftCode, normalizeGiftCode } from "@/lib/gift-card-rules";
import { siteUrl } from "@/lib/site";
import { stripe } from "@/lib/stripe";

// Studio gift cards: bought on the studio page through Stripe (on the
// photographer's own account) or issued free by the photographer, emailed to
// the recipient (now or on a chosen day), and used at booking.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// A fresh, unused code.
export async function newGiftCode() {
  for (;;) {
    const code = giftCode(randomBytes(8));
    const [taken] = await db.select({ id: giftCards.id }).from(giftCards).where(eq(giftCards.code, code));
    if (!taken) return code;
  }
}

// A studio's usable card by code (active, with money left), or null.
export async function findUsableCard(photographerId: string, input: string, executor: typeof db | Tx = db) {
  const code = normalizeGiftCode(input);
  if (!code) return null;
  const [card] = await executor
    .select()
    .from(giftCards)
    .where(and(eq(giftCards.photographerId, photographerId), eq(giftCards.code, code)));
  if (!card || card.status !== "active" || card.balanceCents <= 0) return null;
  return card;
}

// Takes up to `amountCents` off a card inside the booking's transaction.
// Returns how much was taken (0 if it was used up meanwhile).
export async function takeFromCard(tx: Tx, cardId: string, amountCents: number) {
  if (amountCents <= 0) return 0;
  const [updated] = await tx
    .update(giftCards)
    .set({ balanceCents: sql`${giftCards.balanceCents} - ${amountCents}` })
    .where(and(eq(giftCards.id, cardId), eq(giftCards.status, "active"), gte(giftCards.balanceCents, amountCents)))
    .returning({ id: giftCards.id });
  return updated ? amountCents : 0;
}

// A cancelled or deleted booking gives its gift card amount back to the
// card. Clearing the booking's amount first (only if unchanged) makes this
// safe to call twice.
export async function restoreBookingGiftCard(bookingId: string) {
  const [booking] = await db
    .select({ cardId: bookings.giftCardId, cents: bookings.giftCardCents })
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (!booking?.cardId || booking.cents <= 0) return;
  const cleared = await db
    .update(bookings)
    .set({ giftCardCents: 0 })
    .where(and(eq(bookings.id, bookingId), eq(bookings.giftCardCents, booking.cents)))
    .returning({ id: bookings.id });
  if (cleared.length === 0) return;
  await db
    .update(giftCards)
    .set({ balanceCents: sql`${giftCards.balanceCents} + ${booking.cents}` })
    .where(eq(giftCards.id, booking.cardId));
}

// ---- Buying ----

export async function startGiftCardCheckout(options: {
  cardId: string;
  slug: string;
  studioName: string;
  account: string;
  amountCents: number;
  recipientName: string;
}) {
  const base = `${siteUrl}/studio/${options.slug}/gift-card`;
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: options.amountCents,
            product_data: { name: `${options.studioName} gift card`, description: `For ${options.recipientName}` },
          },
        },
      ],
      metadata: { giftCardId: options.cardId, kind: "gift_card" },
      payment_intent_data: { metadata: { giftCardId: options.cardId, kind: "gift_card" } },
      success_url: `${base}/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/return?session_id={CHECKOUT_SESSION_ID}&cancelled=1`,
    },
    { stripeContext: options.account },
  );
  await db.insert(payments).values({
    giftCardId: options.cardId,
    kind: "gift_card",
    amountCents: options.amountCents,
    stripeAccountId: options.account,
    stripeCheckoutSessionId: session.id,
  });
  return session.url;
}

// Paid: the card turns on, the buyer gets a receipt, the studio is told, and
// the recipient gets it now (or on their day). Only once per card.
export async function activatePurchasedCard(cardId: string) {
  const [activated] = await db
    .update(giftCards)
    .set({ status: "active" })
    .where(and(eq(giftCards.id, cardId), eq(giftCards.status, "pending_payment")))
    .returning();
  if (!activated) return;
  const loaded = await loadCard(cardId);
  if (!loaded) return;
  const { card, facts, timeZone } = loaded;
  if (card.buyerEmail && card.recipientEmail) {
    await sendToClient(
      card.photographerId,
      "gift_card_receipt",
      card.buyerEmail,
      giftCardReceipt({
        ...facts,
        recipientEmail: card.recipientEmail,
        deliverOn: dueNow(card.deliverOn, timeZone) ? null : formatDate(new Date(`${card.deliverOn}T12:00:00Z`), "UTC"),
      }),
    );
  }
  await sendToStudio(card.photographerId, "gift_card_sold", giftCardSoldStudio({ ...facts, dashboardUrl: `${siteUrl}/dashboard/gift-cards` }), {
    replyTo: card.buyerEmail,
  });
  if (dueNow(card.deliverOn, timeZone)) await claimAndDeliver(cardId, new Date());
}

// Marks a card delivered before emailing it, so the paid step and the
// scheduled job can never both send it.
async function claimAndDeliver(cardId: string, now: Date) {
  const [claimed] = await db
    .update(giftCards)
    .set({ deliveredAt: now })
    .where(and(eq(giftCards.id, cardId), isNull(giftCards.deliveredAt)))
    .returning({ id: giftCards.id });
  return claimed ? deliverGiftCard(cardId) : false;
}

const dueNow = (deliverOn: string | null, timeZone: string) => !deliverOn || deliverOn <= localDateOf(new Date(), timeZone);

async function loadCard(cardId: string) {
  const [row] = await db
    .select({ card: giftCards, studio: photographers })
    .from(giftCards)
    .innerJoin(photographers, eq(photographers.id, giftCards.photographerId))
    .where(eq(giftCards.id, cardId));
  if (!row) return null;
  const { card, studio } = row;
  const facts: GiftCardFacts = {
    studioName: studio.businessName || studio.name,
    code: card.code,
    amountCents: card.amountCents,
    recipientName: card.recipientName,
    buyerName: card.buyerName,
    message: card.message,
    bookUrl: studio.studioSlug ? `${siteUrl}/studio/${studio.studioSlug}/book` : siteUrl,
  };
  return { card, facts, timeZone: studio.timeZone };
}

// Emails the card to its recipient (also used for "Resend").
export async function deliverGiftCard(cardId: string) {
  const loaded = await loadCard(cardId);
  const to = loaded?.card.recipientEmail;
  if (!loaded || !to || loaded.card.status !== "active") return false;
  const { card, facts } = loaded;
  const sent = await sendToClient(card.photographerId, "gift_card", to, giftCardRecipient(facts));
  await db.update(giftCards).set({ deliveredAt: new Date() }).where(eq(giftCards.id, cardId));
  return sent;
}

// The scheduled job: cards whose delivery day has come (from 8 am in the
// studio's time zone).
export async function sendDueGiftCards(now = new Date()) {
  const due = await db
    .select({ id: giftCards.id, deliverOn: giftCards.deliverOn, timeZone: photographers.timeZone })
    .from(giftCards)
    .innerJoin(photographers, eq(photographers.id, giftCards.photographerId))
    .where(
      and(
        eq(giftCards.status, "active"),
        isNull(giftCards.deliveredAt),
        isNotNull(giftCards.recipientEmail),
        or(isNull(giftCards.deliverOn), lte(giftCards.deliverOn, localDateOf(new Date(now.getTime() + 14 * 3600_000), "UTC"))),
      ),
    );
  let sent = 0;
  for (const card of due) {
    const today = localDateOf(now, card.timeZone);
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: card.timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
    if (card.deliverOn && (card.deliverOn > today || (card.deliverOn === today && hour < 8))) continue;
    if (await claimAndDeliver(card.id, now)) sent++;
  }
  return sent;
}
