import { and, asc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, photographers, sessionCredits } from "@/db/schema";
import { addDays, localDateOf } from "@/lib/booking/time";

// Session credits (like PhotoEZ Booking's): money a client can put toward a
// future booking with the same studio, matched by email.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const emailKey = (email: string) => email.trim().toLowerCase();

// Credits still usable today (not expired, not used up), soonest to expire first.
function usableCredits(executor: typeof db | Tx, photographerId: string, email: string, today: string) {
  return executor
    .select()
    .from(sessionCredits)
    .where(
      and(
        eq(sessionCredits.photographerId, photographerId),
        eq(sessionCredits.clientEmail, emailKey(email)),
        sql`${sessionCredits.usedCents} < ${sessionCredits.amountCents}`,
        or(isNull(sessionCredits.expiresOn), gte(sessionCredits.expiresOn, today)),
      ),
    )
    .orderBy(sql`${sessionCredits.expiresOn} asc nulls last`, asc(sessionCredits.createdAt));
}

export async function creditBalance(photographerId: string, email: string, today: string) {
  const rows = await usableCredits(db, photographerId, email, today);
  return rows.reduce((sum, c) => sum + c.amountCents - c.usedCents, 0);
}

// Uses up to `amountCents` of a client's credit, soonest-expiring first.
// Returns how much was used. Runs inside the booking's transaction.
export async function useCredits(tx: Tx, photographerId: string, email: string, today: string, amountCents: number) {
  let remaining = amountCents;
  for (const credit of await usableCredits(tx, photographerId, email, today)) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, credit.amountCents - credit.usedCents);
    await tx
      .update(sessionCredits)
      .set({ usedCents: credit.usedCents + take })
      .where(eq(sessionCredits.id, credit.id));
    remaining -= take;
  }
  return amountCents - remaining;
}

// Adds a credit, expiring after the studio's chosen number of months.
export async function issueCredit(options: {
  photographerId: string;
  clientEmail: string;
  clientName: string;
  amountCents: number;
  reason: string;
  sourceBookingId?: string | null;
  expiresOn?: string | null;
}) {
  if (options.amountCents <= 0) return;
  let expiresOn = options.expiresOn;
  if (expiresOn === undefined) {
    const [studio] = await db
      .select({ months: photographers.creditValidMonths, timeZone: photographers.timeZone })
      .from(photographers)
      .where(eq(photographers.id, options.photographerId));
    expiresOn = studio.months ? addDays(localDateOf(new Date(), studio.timeZone), Math.round(studio.months * 30.44)) : null;
  }
  await db.insert(sessionCredits).values({
    photographerId: options.photographerId,
    clientEmail: emailKey(options.clientEmail),
    clientName: options.clientName,
    amountCents: options.amountCents,
    reason: options.reason,
    sourceBookingId: options.sourceBookingId ?? null,
    expiresOn,
  });
}

// When a booking that used credit is cancelled, the client gets it back as a
// new credit. Clearing the booking's creditCents first (only if unchanged)
// makes this safe to call twice.
export async function returnBookingCredit(bookingId: string) {
  const [booking] = await db
    .select({
      photographerId: bookings.photographerId,
      clientEmail: bookings.clientEmail,
      clientName: bookings.clientName,
      creditCents: bookings.creditCents,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (!booking || booking.creditCents <= 0) return;
  const cleared = await db
    .update(bookings)
    .set({ creditCents: 0 })
    .where(and(eq(bookings.id, bookingId), eq(bookings.creditCents, booking.creditCents)))
    .returning({ id: bookings.id });
  if (cleared.length === 0) return;
  await issueCredit({
    photographerId: booking.photographerId,
    clientEmail: booking.clientEmail,
    clientName: booking.clientName,
    amountCents: booking.creditCents,
    reason: "Returned from a cancelled booking",
    sourceBookingId: bookingId,
  });
}
