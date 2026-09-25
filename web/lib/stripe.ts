import Stripe from "stripe";

// PhotoEZ Cloud's Stripe account (the "platform"). Photographers connect
// their own Stripe accounts to it (Stripe Connect), and every client payment
// is created on the photographer's account, so the money goes straight to them.
// Test mode until the keys in .env are switched to live ones.

let client: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe isn't set up yet (STRIPE_SECRET_KEY is missing).");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}
