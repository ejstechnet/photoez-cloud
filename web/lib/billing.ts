import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { REFERRAL_COUPON_ID, hasFeature, planFromLookupKey, priceLookupKey, type Interval, type PaidPlan } from "@/lib/plans";
import { rewardReferral } from "@/lib/referrals";
import { siteUrl } from "@/lib/site";
import { stripe } from "@/lib/stripe";

// PhotoEZ Cloud's own subscriptions (Pro and Studio), billed on the PhotoEZ
// Cloud Stripe account itself: never on a photographer's connected account,
// which is only for their clients' payments. Prices are found by lookup key
// (lib/plans.ts), created once by scripts/stripe-billing-setup.mjs.
//
// The photographer's plan changes only through syncSubscription, from the
// webhook or the return from Checkout, whichever comes first.

// Stripe statuses that keep the paid plan. past_due keeps it while Stripe
// retries the card; anything else (canceled, unpaid, incomplete…) is Free.
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

async function priceId(plan: PaidPlan, interval: Interval) {
  const key = priceLookupKey(plan, interval);
  const { data } = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  if (!data[0]) throw new Error(`No Stripe price with lookup key ${key}. Run scripts/stripe-billing-setup.mjs.`);
  return data[0].id;
}

// The photographer's customer record on the PhotoEZ Cloud account, made on
// first use.
export async function billingCustomer(photographerId: string) {
  const [studio] = await db
    .select({
      customerId: photographers.billingCustomerId,
      email: photographers.email,
      name: photographers.name,
      businessName: photographers.businessName,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (studio.customerId) return studio.customerId;
  const customer = await stripe().customers.create({
    email: studio.email,
    name: studio.businessName || studio.name,
    metadata: { photographerId },
  });
  await db.update(photographers).set({ billingCustomerId: customer.id }).where(eq(photographers.id, photographerId));
  return customer.id;
}

// A Stripe Checkout page for a new subscription.
export async function subscriptionCheckoutUrl(photographerId: string, plan: PaidPlan, interval: Interval) {
  const discount = await referralDiscount(photographerId);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await billingCustomer(photographerId),
    client_reference_id: photographerId,
    line_items: [{ price: await priceId(plan, interval), quantity: 1 }],
    subscription_data: { metadata: { photographerId } },
    // Stripe allows either a set discount or a promo code box, not both.
    ...(discount ? { discounts: [{ coupon: discount }] } : { allow_promotion_codes: true }),
    success_url: `${siteUrl}/dashboard/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/dashboard/billing`,
  });
  if (!session.url) throw new Error("Stripe didn't return a Checkout page.");
  return session.url;
}

// A referred studio's 20% off, on its first subscription only (never after
// it has paid once), when the coupon exists in Stripe.
async function referralDiscount(photographerId: string) {
  const [studio] = await db
    .select({ referredById: photographers.referredById, subscriptionId: photographers.subscriptionId })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio?.referredById || studio.subscriptionId) return null;
  try {
    const coupon = await stripe().coupons.retrieve(REFERRAL_COUPON_ID);
    return coupon.valid ? coupon.id : null;
  } catch {
    return null;
  }
}

// Stripe's billing portal: change plan, update the card, see invoices, cancel.
export async function billingPortalUrl(photographerId: string) {
  const customer = await billingCustomer(photographerId);
  // The portal settings made by the setup script (plan switching between
  // Pro and Studio), when they exist; otherwise Stripe's default portal.
  const { data } = await stripe().billingPortal.configurations.list({ active: true, limit: 20 });
  const configuration = data.find((c) => c.metadata?.app === "photoez_cloud")?.id;
  const session = await stripe().billingPortal.sessions.create({
    customer,
    return_url: `${siteUrl}/dashboard/billing`,
    ...(configuration ? { configuration } : {}),
  });
  return session.url;
}

// Copies a subscription onto the photographer: plan, interval, status, and
// renewal date. Safe to run more than once, and in any order.
export async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const [studio] = await db
    .select({ id: photographers.id, subscriptionId: photographers.subscriptionId })
    .from(photographers)
    .where(eq(photographers.billingCustomerId, customerId));
  if (!studio) return;
  // A leftover event for an older subscription doesn't undo the current one.
  if (studio.subscriptionId && studio.subscriptionId !== subscription.id && !PAID_STATUSES.has(subscription.status)) {
    return;
  }

  const item = subscription.items.data[0];
  const bought = planFromLookupKey(item?.price.lookup_key);
  const paid = bought !== null && PAID_STATUSES.has(subscription.status);
  await db
    .update(photographers)
    .set({
      plan: paid ? bought.plan : "free",
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      planInterval: bought?.interval ?? null,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
      // Studio's branding switch goes back on when the plan no longer has it.
      ...(paid && hasFeature(bought.plan, "removeBranding") ? {} : { hideBranding: false }),
      // A paid plan ends the free trial.
      ...(paid ? { trialEndsAt: null } : {}),
    })
    .where(eq(photographers.id, studio.id));
  // A referred studio's first payment earns its referrer a month of credit.
  if (paid) await rewardReferral(studio.id);
}

// The return from Checkout: syncs right away instead of waiting on the webhook.
export async function syncCheckoutSession(photographerId: string, sessionId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== photographerId || session.mode !== "subscription") return false;
  if (session.subscription && typeof session.subscription !== "string") {
    await syncSubscription(session.subscription);
    return true;
  }
  return false;
}

// Billing asks Stripe for the latest on open, so changes made in the portal
// show even before (or without) the webhook.
export async function refreshSubscription(photographerId: string) {
  const [studio] = await db
    .select({ subscriptionId: photographers.subscriptionId })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio?.subscriptionId) return;
  await syncSubscription(await stripe().subscriptions.retrieve(studio.subscriptionId));
}
