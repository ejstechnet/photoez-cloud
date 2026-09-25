import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { stripe } from "@/lib/stripe";

// Asks Stripe whether a photographer's connected account can take payments
// yet, and saves the answer. Stripe sometimes approves a moment after the
// photographer returns from its sign-up screens, so Settings calls this while
// the account is still waiting (the account.updated webhook does it too).
export async function syncStripeStatus(photographerId: string, accountId: string) {
  const account = await stripe().accounts.retrieve(accountId);
  await db
    .update(photographers)
    .set({ stripeChargesEnabled: account.charges_enabled })
    .where(eq(photographers.id, photographerId));
  return account.charges_enabled;
}
