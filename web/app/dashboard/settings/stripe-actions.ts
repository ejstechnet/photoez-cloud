"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { syncStripeStatus } from "@/lib/payments/connect";
import { stripe } from "@/lib/stripe";

// Connecting a photographer's own Stripe account (Stripe Connect, Standard
// accounts: the photographer owns the account and its dashboard; PhotoEZ
// Cloud takes no fee). Stripe runs the sign-up screens; we only keep the id.

export async function connectStripe(): Promise<void> {
  const photographer = await requirePhotographer();
  const [studio] = await db
    .select({ accountId: photographers.stripeAccountId, email: photographers.email })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));

  let accountId = studio.accountId;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "standard",
      email: studio.email,
      metadata: { photographerId: photographer.id },
    });
    accountId = account.id;
    await db.update(photographers).set({ stripeAccountId: accountId }).where(eq(photographers.id, photographer.id));
  }

  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl}/dashboard/settings/stripe/refresh`,
    return_url: `${siteUrl}/dashboard/settings/stripe/return`,
  });
  redirect(link.url);
}

// Checks Stripe for the account's status (after returning from sign-up, or on demand).
export async function refreshStripeStatus(): Promise<void> {
  const photographer = await requirePhotographer();
  const [studio] = await db
    .select({ accountId: photographers.stripeAccountId })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (!studio.accountId) return;
  await syncStripeStatus(photographer.id, studio.accountId);
  revalidatePath("/dashboard/settings");
}
