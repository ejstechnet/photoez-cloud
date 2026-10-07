import { and, asc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";

// The Bookings calendar's sessions between two times (not cancelled), each
// with what's been paid online so far.
export function calendarBookings(photographerId: string, from: Date, to: Date) {
  return db
    .select({
      booking: bookings,
      // bookings.id written out: ${bookings.id} renders as a bare "id" here
      // (one-table select), which Postgres would read as payments.id.
      paidCents: sql<number>`(select coalesce(sum(amount_cents), 0) from payments where payments.booking_id = bookings.id and payments.status = 'paid')::int`,
    })
    .from(bookings)
    .where(and(eq(bookings.photographerId, photographerId), ne(bookings.status, "cancelled"), gte(bookings.startsAt, from), lt(bookings.startsAt, to)))
    .orderBy(asc(bookings.startsAt));
}
