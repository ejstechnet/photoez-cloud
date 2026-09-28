import { randomBytes } from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { photographers, referralRewards } from "@/db/schema";
import { billingCustomer } from "@/lib/billing";
import { REFERRAL_YEARLY_CAP, effectivePlan, referralRewardCents } from "@/lib/plans";
import { stripe } from "@/lib/stripe";

// Photographer referrals (decided with Elle 2026-09-27): each studio has a
// link, /r/<code>. A photographer who signs up through it gets 20% off their
// first plan payment; once that payment goes through, the referrer gets one
// month of their plan as credit on their PhotoEZ Cloud bill, up to 12 a year.
// The credit sits on the referrer's Stripe customer balance, which Stripe
// takes off their next invoices by itself.

export const REFERRAL_COOKIE = "pez_ref";
export const REFERRAL_COOKIE_DAYS = 60;

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newCode() {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

// The studio's referral code, made the first time it's needed.
export async function referralCodeFor(photographerId: string) {
  const [studio] = await db
    .select({ code: photographers.referralCode })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (studio?.code) return studio.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const [taken] = await db.select({ id: photographers.id }).from(photographers).where(eq(photographers.referralCode, code));
    if (taken) continue;
    await db.update(photographers).set({ referralCode: code }).where(eq(photographers.id, photographerId));
    return code;
  }
  throw new Error("Couldn't make a referral code.");
}

export const isReferralCode = (code: string) => /^[a-z0-9]{4,20}$/.test(code);

// Who a code belongs to, for the /r link and the sign-up page's greeting.
export async function referrerByCode(code: string) {
  if (!isReferralCode(code)) return null;
  const [studio] = await db
    .select({ id: photographers.id, name: photographers.name, businessName: photographers.businessName })
    .from(photographers)
    .where(eq(photographers.referralCode, code));
  return studio ? { id: studio.id, name: studio.businessName || studio.name } : null;
}

// The referrer's id from a sign-up request's cookies (Better Auth's hook).
export async function referrerFromCookieHeader(cookieHeader: string | null | undefined) {
  const match = new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=([a-z0-9]+)`).exec(cookieHeader ?? "");
  return match ? ((await referrerByCode(match[1]))?.id ?? null) : null;
}

// Called whenever a studio's subscription is paid (lib/billing.ts): rewards
// the studio's referrer once, the first time. Safe to run again.
export async function rewardReferral(referredId: string) {
  const [studio] = await db
    .select({ referredById: photographers.referredById })
    .from(photographers)
    .where(eq(photographers.id, referredId));
  if (!studio?.referredById || studio.referredById === referredId) return;
  const referrerId = studio.referredById;
  const [referrer] = await db
    .select({ plan: photographers.plan, trialEndsAt: photographers.trialEndsAt })
    .from(photographers)
    .where(eq(photographers.id, referrerId));
  if (!referrer) return;

  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const [{ earned }] = await db
    .select({ earned: count() })
    .from(referralRewards)
    .where(
      and(
        eq(referralRewards.referrerId, referrerId),
        eq(referralRewards.status, "credited"),
        gte(referralRewards.createdAt, yearAgo),
      ),
    );
  const capped = earned >= REFERRAL_YEARLY_CAP;
  const amountCents = capped ? 0 : referralRewardCents(effectivePlan(referrer.plan, referrer.trialEndsAt));

  // The unique referred studio makes this a one-time reward, even if two
  // Stripe messages arrive together.
  const [reward] = await db
    .insert(referralRewards)
    .values({ referrerId, referredId, status: capped ? "capped" : "credited", amountCents })
    .onConflictDoNothing()
    .returning({ id: referralRewards.id });
  if (!reward || capped) return;

  try {
    await stripe().customers.createBalanceTransaction(
      await billingCustomer(referrerId),
      { amount: -amountCents, currency: "usd", description: "Referral credit: a studio you referred joined PhotoEZ Cloud" },
      { idempotencyKey: `referral-${reward.id}` },
    );
  } catch (error) {
    // Let the next Stripe message try again.
    await db.delete(referralRewards).where(eq(referralRewards.id, reward.id));
    throw error;
  }
}

// For Billing's "Refer a photographer" card.
export async function referralSummary(photographerId: string) {
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const [code, [signups], rewards] = await Promise.all([
    referralCodeFor(photographerId),
    db.select({ n: count() }).from(photographers).where(eq(photographers.referredById, photographerId)),
    db
      .select({ status: referralRewards.status, amountCents: referralRewards.amountCents, createdAt: referralRewards.createdAt })
      .from(referralRewards)
      .where(eq(referralRewards.referrerId, photographerId))
      .orderBy(desc(referralRewards.createdAt)),
  ]);
  const credited = rewards.filter((r) => r.status === "credited");
  return {
    code,
    signups: signups.n,
    paid: rewards.length,
    earnedCents: credited.reduce((sum, r) => sum + r.amountCents, 0),
    thisYear: credited.filter((r) => r.createdAt >= yearAgo).length,
  };
}
