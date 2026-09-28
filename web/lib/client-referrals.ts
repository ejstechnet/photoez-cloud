import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, clients, photographers } from "@/db/schema";
import { issueCredit } from "@/lib/credits";
import { emailReferralCredit } from "@/lib/email/notify";
import { siteUrl } from "@/lib/site";

// Client referrals (decided with Elle 2026-09-28): a studio's clients share
// a link, /studio/<slug>/friend/<code>. A friend booking their first session
// with the studio through it gets a discount ($25 by default), and once that
// session has happened, the client who shared gets a session credit ($25 by
// default). Photographers switch it on and set the amounts in Settings.

export const FRIEND_COOKIE = "pez_friend";
export const FRIEND_COOKIE_DAYS = 60;

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

// A client's code, made the first time it's needed.
export async function clientReferralCode(clientId: string) {
  const [client] = await db.select({ code: clients.referralCode }).from(clients).where(eq(clients.id, clientId));
  if (client?.code) return client.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(randomBytes(8), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    const updated = await db
      .update(clients)
      .set({ referralCode: code })
      .where(and(eq(clients.id, clientId), isNull(clients.referralCode)))
      .returning({ id: clients.id })
      .catch(() => []);
    if (updated.length > 0) return code;
    const [again] = await db.select({ code: clients.referralCode }).from(clients).where(eq(clients.id, clientId));
    if (again?.code) return again.code;
  }
  throw new Error("Couldn't make a referral code.");
}

// The share link for a studio's client, when the studio has referrals on.
export async function clientReferralLink(photographerId: string, clientEmail: string | null) {
  if (!clientEmail) return null;
  const [row] = await db
    .select({
      clientId: clients.id,
      slug: photographers.studioSlug,
      enabled: photographers.clientReferralsEnabled,
      rewardCents: photographers.clientReferralRewardCents,
      discountCents: photographers.clientReferralDiscountCents,
    })
    .from(clients)
    .innerJoin(photographers, eq(photographers.id, clients.photographerId))
    .where(and(eq(clients.photographerId, photographerId), sql`lower(${clients.email}) = lower(${clientEmail})`))
    .limit(1);
  if (!row?.enabled || !row.slug) return null;
  return {
    url: `${siteUrl}/studio/${row.slug}/friend/${await clientReferralCode(row.clientId)}`,
    rewardCents: row.rewardCents,
    discountCents: row.discountCents,
  };
}

// Who shared a code, if it belongs to this studio and referrals are on.
export async function referringClient(photographerId: string, code: string | null | undefined) {
  if (!code || !/^[a-z0-9]{4,20}$/.test(code)) return null;
  const [row] = await db
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      enabled: photographers.clientReferralsEnabled,
      rewardCents: photographers.clientReferralRewardCents,
      discountCents: photographers.clientReferralDiscountCents,
    })
    .from(clients)
    .innerJoin(photographers, eq(photographers.id, clients.photographerId))
    .where(and(eq(clients.referralCode, code), eq(clients.photographerId, photographerId)));
  return row?.enabled ? row : null;
}

// The friend's discount at booking: only on their first booking with the
// studio, never for the person who shared the link, and never more than the
// total. Returns 0 when it doesn't apply.
export async function friendDiscountFor(options: {
  photographerId: string;
  code: string | null | undefined;
  email: string;
  totalCents: number;
}) {
  const referrer = await referringClient(options.photographerId, options.code);
  if (!referrer || referrer.email?.toLowerCase() === options.email.trim().toLowerCase()) return null;
  const [earlier] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.photographerId, options.photographerId),
        sql`lower(${bookings.clientEmail}) = lower(${options.email})`,
      ),
    )
    .limit(1);
  if (earlier) return null;
  return {
    referrerId: referrer.id,
    discountCents: Math.min(referrer.discountCents, Math.max(0, options.totalCents)),
    rewardCents: referrer.rewardCents,
  };
}

// Run by the 15-minute job: once a referred friend's session has happened
// (its end time passed and it wasn't cancelled), the client who shared the
// link gets their credit and an email. Each booking is claimed first, so it
// can only pay out once.
export async function payDueClientReferrals(now = new Date()) {
  const due = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        isNotNull(bookings.referredByClientId),
        isNull(bookings.referralRewardedAt),
        inArray(bookings.status, ["confirmed", "completed"]),
        lte(bookings.endsAt, now),
        ne(bookings.referralRewardCents, 0),
      ),
    );
  let paid = 0;
  for (const { id } of due) {
    const [booking] = await db
      .update(bookings)
      .set({ referralRewardedAt: now })
      .where(and(eq(bookings.id, id), isNull(bookings.referralRewardedAt)))
      .returning();
    if (!booking?.referredByClientId) continue;
    const [referrer] = await db
      .select({ name: clients.name, email: clients.email })
      .from(clients)
      .where(eq(clients.id, booking.referredByClientId));
    if (!referrer?.email) continue;
    const credit = await issueCredit({
      photographerId: booking.photographerId,
      clientEmail: referrer.email,
      clientName: referrer.name,
      amountCents: booking.referralRewardCents,
      reason: `Referral: ${booking.clientName} had their session`,
      sourceBookingId: booking.id,
    });
    if (!credit) continue;
    await emailReferralCredit({
      photographerId: booking.photographerId,
      to: referrer.email,
      clientName: referrer.name,
      friendName: booking.clientName,
      amountCents: credit.amountCents,
      expiresOn: credit.expiresOn,
    });
    paid++;
  }
  return paid;
}
