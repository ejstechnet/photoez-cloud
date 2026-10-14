"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { forgetStripeAccount, isMissingAccount, syncStripeStatus } from "@/lib/payments/connect";
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

  let url: string;
  try {
    url = await onboardingUrl(photographer.id, studio.email, studio.accountId);
  } catch (err) {
    // Shown as a message on Settings > Payments instead of an error page.
    console.error("Connect Stripe failed:", err);
    redirect("/dashboard/settings?stripe=failed#payments");
  }
  redirect(url);
}

// The link to Stripe's sign-up screens. A saved account Stripe no longer knows
// is dropped and a new one made; a new account is saved only once Stripe has
// handed over its link, so a failure halfway never leaves one stuck.
async function onboardingUrl(photographerId: string, email: string, savedId: string | null) {
  let accountId = savedId;
  if (accountId) {
    try {
      await stripe().accounts.retrieve(accountId);
    } catch (err) {
      if (!isMissingAccount(err)) throw err;
      await forgetStripeAccount(photographerId, accountId);
      accountId = null;
    }
  }
  const isNew = !accountId;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "standard",
      email,
      metadata: { photographerId },
    });
    accountId = account.id;
  }

  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${siteUrl}/dashboard/settings/stripe/refresh`,
    return_url: `${siteUrl}/dashboard/settings/stripe/return`,
  });
  if (isNew) await db.update(photographers).set({ stripeAccountId: accountId }).where(eq(photographers.id, photographerId));
  return link.url;
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
