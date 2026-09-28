import { and, eq, gt, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, galleries, photographers } from "@/db/schema";
import { sendDueGiftCards } from "@/lib/gift-cards";
import { sendDueReviewRequests } from "@/lib/review-requests";
import { payDueClientReferrals } from "@/lib/client-referrals";
import { emailBalanceReminder, emailGalleryExpiring, emailSessionReminder } from "./notify";

// The scheduled reminders (PhotoEZ for WordPress sends these from WP-Cron):
// the session reminder, the balance reminder, "your gallery closes soon",
// and review requests; plus client referral credits.
// The server runs this every 15 minutes (see app/api/cron/reminders). Each
// reminder is claimed before it's sent, so two runs at once can't send twice.

const HOUR = 60 * 60 * 1000;

export async function runReminders(now = new Date()) {
  const sent = { session: 0, balance: 0, gallery: 0, reviews: 0, giftCards: 0, referrals: 0 };

  // Session reminder: N hours before, for confirmed bookings.
  const sessionDue = await db
    .select({ id: bookings.id, createdAt: bookings.createdAt, startsAt: bookings.startsAt, hours: photographers.sessionReminderHours })
    .from(bookings)
    .innerJoin(photographers, eq(photographers.id, bookings.photographerId))
    .where(
      and(
        eq(bookings.status, "confirmed"),
        isNull(bookings.reminderSentAt),
        isNotNull(photographers.sessionReminderHours),
        gt(bookings.startsAt, now),
        lte(bookings.startsAt, sql`${now.toISOString()}::timestamptz + make_interval(hours => ${photographers.sessionReminderHours})`),
      ),
    );
  for (const b of sessionDue) {
    if (!(await claim("session", b.id, now))) continue;
    // Booked inside the reminder window: the confirmation just told them everything.
    if (b.startsAt.getTime() - b.createdAt.getTime() < (b.hours ?? 0) * HOUR) continue;
    if (await emailSessionReminder(b.id)) sent.session++;
  }

  // Balance reminder: N days before, when something is still owed and the
  // studio takes payments online.
  const balanceDue = await db
    .select({ id: bookings.id, createdAt: bookings.createdAt, startsAt: bookings.startsAt, days: photographers.balanceReminderDays })
    .from(bookings)
    .innerJoin(photographers, eq(photographers.id, bookings.photographerId))
    .where(
      and(
        eq(bookings.status, "confirmed"),
        isNull(bookings.balanceReminderSentAt),
        isNotNull(photographers.balanceReminderDays),
        eq(photographers.stripeChargesEnabled, true),
        gt(bookings.startsAt, now),
        lte(bookings.startsAt, sql`${now.toISOString()}::timestamptz + make_interval(days => ${photographers.balanceReminderDays})`),
      ),
    );
  for (const b of balanceDue) {
    if (!(await claim("balance", b.id, now))) continue;
    if (b.startsAt.getTime() - b.createdAt.getTime() < (b.days ?? 0) * 24 * HOUR) continue;
    if (await emailBalanceReminder(b.id)) sent.balance++;
  }

  // Gallery closing soon: N days before it expires, while proofing or delivered.
  const expiring = await db
    .select({ id: galleries.id })
    .from(galleries)
    .innerJoin(photographers, eq(photographers.id, galleries.photographerId))
    .where(
      and(
        inArray(galleries.status, ["pending", "delivered"]),
        isNull(galleries.expiryReminderSentAt),
        isNotNull(photographers.galleryExpiryReminderDays),
        gt(galleries.expiresAt, now),
        lte(galleries.expiresAt, sql`${now.toISOString()}::timestamptz + make_interval(days => ${photographers.galleryExpiryReminderDays})`),
      ),
    );
  for (const g of expiring) {
    const [claimed] = await db
      .update(galleries)
      .set({ expiryReminderSentAt: now })
      .where(and(eq(galleries.id, g.id), isNull(galleries.expiryReminderSentAt)))
      .returning({ id: galleries.id });
    if (claimed && (await emailGalleryExpiring(g.id))) sent.gallery++;
  }

  // Review requests a few days after delivery.
  sent.reviews = await sendDueReviewRequests(now);

  // Gift cards scheduled for a day that has come.
  sent.giftCards = await sendDueGiftCards(now);

  // Client referrals: credit for the client who shared, once their friend's session has happened.
  sent.referrals = await payDueClientReferrals(now);

  return sent;
}

// Marks a booking's reminder as sent; false when another run got there first.
async function claim(which: "session" | "balance", bookingId: string, now: Date) {
  const column = which === "session" ? bookings.reminderSentAt : bookings.balanceReminderSentAt;
  const [claimed] = await db
    .update(bookings)
    .set(which === "session" ? { reminderSentAt: now } : { balanceReminderSentAt: now })
    .where(and(eq(bookings.id, bookingId), isNull(column)))
    .returning({ id: bookings.id });
  return Boolean(claimed);
}
