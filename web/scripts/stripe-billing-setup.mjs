// Creates PhotoEZ Cloud's plans in Stripe: the Pro and Studio products, a
// monthly and a yearly price for each (found by lookup key, see
// lib/plans.ts), and billing portal settings that let photographers switch
// plans, update their card, and cancel. Safe to run again: anything that
// already exists is reused. Run once per Stripe mode (test, then live):
//
//   node --env-file=.env scripts/stripe-billing-setup.mjs

import Stripe from "stripe";

// Keep in step with PLAN_PRICES in lib/plans.ts.
const PLANS = {
  pro: { name: "PhotoEZ Cloud Pro", month: 1900, year: 19000 },
  studio: { name: "PhotoEZ Cloud Studio", month: 3900, year: 39000 },
};

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY is missing from .env");
const stripe = new Stripe(key);
console.log(`Stripe ${key.startsWith("sk_live_") ? "LIVE" : "test"} mode`);

const portalProducts = [];
for (const [plan, info] of Object.entries(PLANS)) {
  const lookupKeys = ["month", "year"].map((interval) => `photoez_${plan}_${interval}`);
  const { data: existing } = await stripe.prices.list({ lookup_keys: lookupKeys, active: true, expand: ["data.product"] });

  let product = existing[0]?.product;
  if (!product) {
    product = await stripe.products.create({ name: info.name, metadata: { app: "photoez_cloud", plan } });
    console.log(`Created product ${product.name}`);
  }

  const prices = [];
  for (const interval of ["month", "year"]) {
    const lookup_key = `photoez_${plan}_${interval}`;
    let price = existing.find((p) => p.lookup_key === lookup_key);
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: info[interval],
        recurring: { interval },
        lookup_key,
        metadata: { app: "photoez_cloud" },
      });
      console.log(`Created ${lookup_key}: $${info[interval] / 100}/${interval}`);
    } else if (price.unit_amount !== info[interval]) {
      console.warn(`! ${lookup_key} is $${price.unit_amount / 100} in Stripe, $${info[interval] / 100} here. Not changed.`);
    }
    prices.push(price.id);
  }
  portalProducts.push({ product: product.id, prices });
}

const features = {
  customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
  invoice_history: { enabled: true },
  payment_method_update: { enabled: true },
  subscription_cancel: { enabled: true, mode: "at_period_end" },
  subscription_update: {
    enabled: true,
    default_allowed_updates: ["price"],
    products: portalProducts,
    // Upgrades charge the difference right away, so the next bill is the
    // plain plan price instead of a surprise catch-up amount.
    proration_behavior: "always_invoice",
    // Downgrades (Studio → Pro, yearly → monthly) wait for the next billing
    // date: the studio keeps what it paid for until then, with no credit.
    schedule_at_period_end: { conditions: [{ type: "decreasing_item_amount" }, { type: "shortening_interval" }] },
  },
};
const { data: configs } = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
const mine = configs.find((c) => c.metadata?.app === "photoez_cloud");
if (mine) {
  await stripe.billingPortal.configurations.update(mine.id, { features });
  console.log("Updated billing portal settings");
} else {
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: "PhotoEZ Cloud: manage your plan" },
    features,
    metadata: { app: "photoez_cloud" },
  });
  console.log("Created billing portal settings");
}
// Referred studios' 20% off their first plan payment (lib/plans.ts).
try {
  await stripe.coupons.retrieve("photoez_referral_20");
} catch {
  await stripe.coupons.create({
    id: "photoez_referral_20",
    name: "Referred by a photographer: 20% off",
    percent_off: 20,
    duration: "once",
    metadata: { app: "photoez_cloud" },
  });
  console.log("Created referral coupon (20% off the first payment)");
}
console.log("Done.");
