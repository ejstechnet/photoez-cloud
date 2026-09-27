"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { billingPortalUrl, subscriptionCheckoutUrl } from "@/lib/billing";
import { INTERVALS, PAID_PLANS, effectivePlan, hasFeature, type Interval, type PaidPlan } from "@/lib/plans";
import { requirePhotographer } from "@/lib/session";
import { stripeConfigured } from "@/lib/stripe";

// Billing's buttons. Both Stripe pages come back to /dashboard/billing.

export async function subscribe(formData: FormData) {
  const photographer = await requirePhotographer();
  const plan = String(formData.get("plan"));
  const interval = String(formData.get("interval"));
  if (!(PAID_PLANS as readonly string[]).includes(plan) || !(INTERVALS as readonly string[]).includes(interval)) {
    redirect("/dashboard/billing");
  }
  if (!stripeConfigured()) redirect("/dashboard/billing?error=stripe");
  const [studio] = await db
    .select({ subscriptionId: photographers.subscriptionId, status: photographers.subscriptionStatus })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  // Already paying: plan changes happen in the billing portal, so there's
  // never a second subscription.
  if (studio.subscriptionId && studio.status !== "canceled" && studio.status !== "incomplete_expired") {
    redirect(await billingPortalUrl(photographer.id));
  }
  redirect(await subscriptionCheckoutUrl(photographer.id, plan as PaidPlan, interval as Interval));
}

export async function manageBilling() {
  const photographer = await requirePhotographer();
  if (!stripeConfigured()) redirect("/dashboard/billing?error=stripe");
  redirect(await billingPortalUrl(photographer.id));
}

// Studio plan: hide "Powered by PhotoEZ Cloud" on the studio's pages.
export async function setHideBranding(hide: boolean): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  const [studio] = await db
    .select({ plan: photographers.plan, trialEndsAt: photographers.trialEndsAt })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (hide && !hasFeature(effectivePlan(studio.plan, studio.trialEndsAt), "removeBranding")) {
    return { error: "Removing the PhotoEZ Cloud credit is on the Studio plan." };
  }
  await db.update(photographers).set({ hideBranding: hide }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/billing");
  revalidatePath("/studio/[slug]", "layout");
  return { ok: true };
}
