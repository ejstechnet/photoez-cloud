import { and, asc, eq, lt, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { bookings, galleries, payments, photographers } from "@/db/schema";
import { PAYMENT_HOLD_MINUTES } from "@/lib/booking/status";
import { siteUrl } from "@/lib/site";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { returnBookingCredit } from "@/lib/credits";
import { nextPayment } from "./amounts";

// Stripe Checkout for booking payments, always on the photographer's own
// connected account. The database only changes when Stripe confirms a payment
// (applyCheckoutSession), from the webhook or the client's return, whichever
// comes first; both are safe to run twice.

// The studio's connected Stripe account, when it can take payments.
export async function paymentAccount(photographerId: string) {
  if (!stripeConfigured()) return null;
  const [studio] = await db
    .select({ id: photographers.stripeAccountId, ready: photographers.stripeChargesEnabled })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  return studio?.id && studio.ready ? studio.id : null;
}

export async function bookingPayments(bookingId: string) {
  return db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(asc(payments.createdAt));
}

type BookingForCheckout = {
  id: string;
  photographerId: string;
  manageToken: string;
  sessionName: string;
  priceCents: number;
  addonsCents: number;
  depositPercent: number;
  clientEmail: string;
  startsAt: Date;
};

// Starts a Checkout page for the next amount owed. Returns its URL, or null
// when nothing is owed or the studio can't take payments.
export async function startCheckout(booking: BookingForCheckout, studioName: string) {
  const account = await paymentAccount(booking.photographerId);
  if (!account) return null;
  const next = nextPayment(booking, await bookingPayments(booking.id));
  if (!next) return null;

  const base = `${siteUrl}/booking/${booking.manageToken}/pay`;
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: booking.clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: next.amountCents,
            product_data: {
              name: `${booking.sessionName} · ${next.kind === "deposit" ? "Deposit" : "Balance"}`,
              description: `${studioName} photography session`,
            },
          },
        },
      ],
      metadata: { bookingId: booking.id, kind: next.kind },
      payment_intent_data: { metadata: { bookingId: booking.id, kind: next.kind } },
      // Checkout's shortest allowed life, which is also how long the time is held.
      expires_at: Math.floor(Date.now() / 1000) + PAYMENT_HOLD_MINUTES * 60,
      success_url: `${base}/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/return?session_id={CHECKOUT_SESSION_ID}&cancelled=1`,
    },
    { stripeContext: account },
  );

  await db.insert(payments).values({
    bookingId: booking.id,
    kind: next.kind,
    amountCents: next.amountCents,
    stripeAccountId: account,
    stripeCheckoutSessionId: session.id,
  });
  return session.url;
}

// Records what Stripe says about a Checkout session. Paid: the payment is
// marked paid, and a held booking is confirmed or a gallery's selections are
// submitted as paid. Expired: a held booking is released so the time opens up.
export async function applyCheckoutSession(session: Stripe.Checkout.Session) {
  const [payment] = await db.select().from(payments).where(eq(payments.stripeCheckoutSessionId, session.id));
  if (!payment) return null;

  if (session.payment_status === "paid" && payment.status !== "paid") {
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: "paid",
          paidAt: new Date(),
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .where(eq(payments.id, payment.id));
      if (payment.bookingId) {
        await tx
          .update(bookings)
          .set({ status: "confirmed", holdExpiresAt: null })
          .where(and(eq(bookings.id, payment.bookingId), eq(bookings.status, "pending_payment")));
      }
      if (payment.galleryId) {
        // The client paid for their extra photos: their selections are in.
        await tx
          .update(galleries)
          .set({
            status: "paid_and_submitted",
            submittedAt: new Date(),
            // Everything paid for extras so far, including before a reopen.
            extrasCount: sql`(select coalesce(sum(quantity), 0) from payments where gallery_id = ${payment.galleryId} and status = 'paid')`,
            extrasCents: sql`(select coalesce(sum(amount_cents), 0) from payments where gallery_id = ${payment.galleryId} and status = 'paid')`,
          })
          .where(and(eq(galleries.id, payment.galleryId), eq(galleries.status, "pending")));
      }
    });
  } else if (session.status === "expired" && payment.status === "pending") {
    await db.update(payments).set({ status: "expired" }).where(eq(payments.id, payment.id));
    if (payment.bookingId) await releaseHold(payment.bookingId);
  }
  return payment;
}

// Cancels a booking still waiting for its deposit, freeing its time.
export async function releaseHold(bookingId: string) {
  const released = await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: "client", holdExpiresAt: null })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "pending_payment")))
    .returning({ id: bookings.id });
  // Any session credit it used goes back to the client.
  if (released.length > 0) await returnBookingCredit(bookingId);
}

// Holds past their time are released before new bookings are saved, so the
// database's no-overlap rule never counts an abandoned checkout.
export async function releaseExpiredHolds(photographerId: string) {
  const expired = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.photographerId, photographerId),
        eq(bookings.status, "pending_payment"),
        lt(bookings.holdExpiresAt, new Date()),
      ),
    );
  for (const booking of expired) await releaseHold(booking.id);
}

// A booking whose deposit hold has run out is released; returns its status now.
export async function settleHold<T extends { id: string; status: string; holdExpiresAt: Date | null }>(booking: T) {
  if (booking.status === "pending_payment" && (booking.holdExpiresAt?.getTime() ?? 0) < Date.now()) {
    await releaseHold(booking.id);
    return { ...booking, status: "cancelled" as const };
  }
  return booking;
}
