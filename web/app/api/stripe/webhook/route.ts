import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { applyCheckoutSession } from "@/lib/payments/checkout";
import { stripe } from "@/lib/stripe";

// Stripe's messages about payments and connected accounts. Every message is
// checked against STRIPE_WEBHOOK_SECRET, so only Stripe can call this.
// Payments happen on photographers' connected accounts, so these arrive as
// Connect events (event.account is the photographer's Stripe account).
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 500 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.expired":
      await applyCheckoutSession(event.data.object);
      break;
    case "account.updated": {
      // A photographer finished (or changed) their Stripe setup.
      const account = event.data.object;
      await db
        .update(photographers)
        .set({ stripeChargesEnabled: account.charges_enabled })
        .where(eq(photographers.stripeAccountId, account.id));
      break;
    }
  }
  return new Response("ok");
}
