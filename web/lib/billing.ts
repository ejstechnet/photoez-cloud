import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { planUsage } from "@/lib/plan-usage";
import {
  MAX_STORAGE_BLOCKS,
  REFERRAL_COUPON_ID,
  canBuyStorage,
  formatStorage,
  hasFeature,
  planFromLookupKey,
  priceLookupKey,
  storageIntervalFromLookupKey,
  storageLimit,
  storageLookupKey,
  type Interval,
  type PaidPlan,
} from "@/lib/plans";
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

// What a Stripe price sells: a plan (and its interval) or extra storage.
// Known by its lookup key, or (for older prices kept by studios who subscribed
// before a price change, which lose their lookup key) by its product's
// metadata from scripts/stripe-billing-setup.mjs.
type PriceKind = { plan: PaidPlan; interval: Interval } | { storage: Interval } | null;
const productKinds = new Map<string, Stripe.Metadata>();

async function priceKind(price: Stripe.Price): Promise<PriceKind> {
  const plan = planFromLookupKey(price.lookup_key);
  if (plan) return plan;
  const storage = storageIntervalFromLookupKey(price.lookup_key);
  if (storage) return { storage };
  const recurring = price.recurring?.interval;
  const interval: Interval | null = recurring === "month" ? "month" : recurring === "year" ? "year" : null;
  if (!interval) return null;
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  let metadata = productKinds.get(productId);
  if (!metadata) {
    const product = typeof price.product === "string" || "deleted" in price.product ? await stripe().products.retrieve(productId) : price.product;
    metadata = product.metadata ?? {};
    productKinds.set(productId, metadata);
  }
  if (metadata.app !== "photoez_cloud") return null;
  if (metadata.addon === "storage") return { storage: interval };
  return metadata.plan === "pro" || metadata.plan === "studio" ? { plan: metadata.plan, interval } : null;
}

const planOf = async (price: Stripe.Price | undefined) => {
  const kind = price ? await priceKind(price) : null;
  return kind && "plan" in kind ? kind : null;
};

async function priceId(plan: PaidPlan, interval: Interval) {
  return priceByKey(priceLookupKey(plan, interval));
}

async function priceByKey(key: string) {
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
  // Extra storage has its own subscription; it never changes the plan.
  if (await storageItem(subscription)) return syncStorage(subscription);
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
  const bought = await planOf(item?.price);
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
  // Extra storage follows the plan: it ends when the plan ends.
  await followPlan(studio.id, paid, subscription.cancel_at_period_end || subscription.cancel_at !== null).catch((e) =>
    console.error("Couldn't update extra storage to match the plan", e),
  );
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
    .select({ subscriptionId: photographers.subscriptionId, storageSubscriptionId: photographers.storageSubscriptionId })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (studio?.storageSubscriptionId) await syncStorage(await stripe().subscriptions.retrieve(studio.storageSubscriptionId));
  if (!studio?.subscriptionId) return;
  await syncSubscription(await stripe().subscriptions.retrieve(studio.subscriptionId));
}

// A downgrade waiting for the next billing date (the portal schedules them):
// the plan and interval it changes to, and when. Null when nothing is scheduled.
export async function scheduledChange(photographerId: string) {
  const [studio] = await db
    .select({ subscriptionId: photographers.subscriptionId })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio?.subscriptionId) return null;
  const subscription = await stripe().subscriptions.retrieve(studio.subscriptionId);
  if (!subscription.schedule) return null;
  const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;
  const schedule = await stripe().subscriptionSchedules.retrieve(scheduleId, { expand: ["phases.items.price"] });
  const now = Date.now() / 1000;
  const next = schedule.phases.find((phase) => phase.start_date > now);
  const price = next?.items[0]?.price;
  const bought = price && typeof price !== "string" && !("deleted" in price && price.deleted) ? await planOf(price) : null;
  return next && bought ? { ...bought, on: new Date(next.start_date * 1000) } : null;
}

// ---- Extra storage (lib/plans.ts) ----

// The extra-storage line on a subscription, if it has one.
async function storageItem(subscription: Stripe.Subscription) {
  for (const item of subscription.items.data) {
    const kind = await priceKind(item.price);
    if (kind && "storage" in kind) return item;
  }
  return undefined;
}

// Copies the storage subscription onto the photographer: how many blocks are
// paid for, and when it renews.
async function syncStorage(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const [studio] = await db
    .select({ id: photographers.id, storageSubscriptionId: photographers.storageSubscriptionId })
    .from(photographers)
    .where(eq(photographers.billingCustomerId, customerId));
  if (!studio) return;
  // An older storage subscription ending doesn't touch the current one.
  if (studio.storageSubscriptionId && studio.storageSubscriptionId !== subscription.id && !PAID_STATUSES.has(subscription.status)) return;
  const item = await storageItem(subscription);
  const live = PAID_STATUSES.has(subscription.status);
  await db
    .update(photographers)
    .set({
      extraStorageBlocks: live ? (item?.quantity ?? 0) : 0,
      storageSubscriptionId: live ? subscription.id : null,
      storagePeriodEnd: live && item ? new Date(item.current_period_end * 1000) : null,
    })
    .where(eq(photographers.id, studio.id));
}

// When the plan ends, extra storage ends with it; when the plan is set to
// cancel at the end of its period (or that's undone), storage does the same.
async function followPlan(photographerId: string, paid: boolean, cancelling: boolean) {
  const [studio] = await db
    .select({ storageSubscriptionId: photographers.storageSubscriptionId })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio?.storageSubscriptionId) return;
  const storage = await stripe().subscriptions.retrieve(studio.storageSubscriptionId);
  if (!PAID_STATUSES.has(storage.status)) return syncStorage(storage);
  if (!paid) return syncStorage(await stripe().subscriptions.cancel(storage.id, { prorate: true }));
  if (storage.cancel_at_period_end !== cancelling) {
    await syncStorage(await stripe().subscriptions.update(storage.id, { cancel_at_period_end: cancelling }));
  }
}

// Sets how many extra storage blocks a studio pays for (0 removes them all).
// Adding charges the difference now, on the plan's card and billing interval;
// removing credits the unused time to the next bill.
export async function setStorageBlocks(photographerId: string, blocks: number): Promise<{ ok: true } | { error: string }> {
  if (!Number.isInteger(blocks) || blocks < 0 || blocks > MAX_STORAGE_BLOCKS) return { error: "Choose how much storage to add." };
  const [studio] = await db
    .select({
      plan: photographers.plan,
      subscriptionId: photographers.subscriptionId,
      status: photographers.subscriptionStatus,
      interval: photographers.planInterval,
      cancelling: photographers.cancelAtPeriodEnd,
      storageSubscriptionId: photographers.storageSubscriptionId,
      current: photographers.extraStorageBlocks,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio) return { error: "Studio not found." };
  if (blocks === studio.current) return { ok: true };
  if (!canBuyStorage(studio.plan) || !studio.subscriptionId || !PAID_STATUSES.has(studio.status ?? "")) {
    return { error: "Extra storage is for the Pro and Studio plans. Choose a plan first." };
  }
  if (blocks > studio.current && studio.cancelling) {
    return { error: "Your plan is set to end. Keep it in Manage billing first, then add storage." };
  }
  // Space already in use can't be given back.
  const usage = await planUsage(photographerId);
  if (blocks < studio.current && usage.storageBytes > storageLimit(studio.plan, blocks)) {
    return {
      error: `You're using ${formatStorage(usage.storageBytes)}, more than ${formatStorage(storageLimit(studio.plan, blocks))}. Delete some photos before removing that much storage.`,
    };
  }

  try {
    const existing = studio.storageSubscriptionId ? await stripe().subscriptions.retrieve(studio.storageSubscriptionId) : null;
    const item = existing ? await storageItem(existing) : undefined;
    if (existing && item && PAID_STATUSES.has(existing.status)) {
      if (blocks === 0) {
        await syncStorage(await stripe().subscriptions.cancel(existing.id, { prorate: true }));
      } else {
        const adding = blocks > (item.quantity ?? 0);
        await syncStorage(
          await stripe().subscriptions.update(existing.id, {
            items: [{ id: item.id, quantity: blocks }],
            // More storage is charged now; less is credited to the next bill.
            proration_behavior: adding ? "always_invoice" : "create_prorations",
            ...(adding ? { payment_behavior: "error_if_incomplete" as const } : {}),
          }),
        );
      }
    } else if (blocks > 0) {
      // Charged on the card the plan uses, billed monthly or yearly like the plan.
      const plan = await stripe().subscriptions.retrieve(studio.subscriptionId);
      const card = typeof plan.default_payment_method === "string" ? plan.default_payment_method : plan.default_payment_method?.id;
      await syncStorage(
        await stripe().subscriptions.create({
          customer: await billingCustomer(photographerId),
          items: [{ price: await priceByKey(storageLookupKey(studio.interval === "year" ? "year" : "month")), quantity: blocks }],
          ...(card ? { default_payment_method: card } : {}),
          payment_behavior: "error_if_incomplete",
          metadata: { photographerId, addon: "storage" },
        }),
      );
    }
  } catch (e) {
    console.error("Extra storage change failed", e);
    const declined = e && typeof e === "object" && "type" in e && (e as { type: unknown }).type === "StripeCardError";
    return {
      error: declined
        ? "Your card was declined. Update it in Manage billing, then try again."
        : "Stripe couldn't make that change right now. Try again in a minute.",
    };
  }
  return { ok: true };
}
