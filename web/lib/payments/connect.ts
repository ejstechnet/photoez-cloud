import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { stripe } from "@/lib/stripe";

// Stripe's answer when a saved connected account can't be reached: it was
// never finished, belongs to the other mode (test vs live), or the
// photographer disconnected PhotoEZ Cloud from their Stripe.
export function isMissingAccount(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "account_invalid" || code === "resource_missing";
}

// Forgets a saved account Stripe no longer knows, so Settings offers
// "Connect Stripe" again instead of failing.
export async function forgetStripeAccount(photographerId: string, accountId: string) {
  await db
    .update(photographers)
    .set({ stripeAccountId: null, stripeChargesEnabled: false })
    .where(and(eq(photographers.id, photographerId), eq(photographers.stripeAccountId, accountId)));
}

// Asks Stripe whether a photographer's connected account can take payments
// yet, and saves the answer. Stripe sometimes approves a moment after the
// photographer returns from its sign-up screens, so Settings calls this while
// the account is still waiting (the account.updated webhook does it too).
export async function syncStripeStatus(photographerId: string, accountId: string) {
  let chargesEnabled: boolean;
  try {
    chargesEnabled = (await stripe().accounts.retrieve(accountId)).charges_enabled;
  } catch (err) {
    if (!isMissingAccount(err)) throw err;
    await forgetStripeAccount(photographerId, accountId);
    return false;
  }
  await db
    .update(photographers)
    .set({ stripeChargesEnabled: chargesEnabled })
    .where(eq(photographers.id, photographerId));
  return chargesEnabled;
}
