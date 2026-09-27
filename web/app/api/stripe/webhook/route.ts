import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { syncSubscription } from "@/lib/billing";
import { applyCheckoutSession } from "@/lib/payments/checkout";
import { stripe } from "@/lib/stripe";

// Stripe's messages about payments, connected accounts, and subscriptions.
// Every message is checked against a signing secret, so only Stripe can
// call this. Two Stripe destinations send here:
// - "Connected accounts" (STRIPE_WEBHOOK_SECRET): client payments, which
//   happen on photographers' own Stripe accounts.
// - "Your account" (STRIPE_BILLING_WEBHOOK_SECRET): photographers' PhotoEZ
//   Cloud subscriptions (lib/billing.ts).
export async function POST(request: Request) {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_BILLING_WEBHOOK_SECRET].filter(
    (s): s is string => Boolean(s),
  );
  if (secrets.length === 0) return new Response("Webhook not configured", { status: 500 });

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe().webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // Try the other destination's secret.
    }
  }
  if (!event) return new Response("Bad signature", { status: 400 });

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.expired":
      // Subscription sign-ups are handled by the subscription events below.
      if (event.data.object.mode !== "subscription") await applyCheckoutSession(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object);
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
