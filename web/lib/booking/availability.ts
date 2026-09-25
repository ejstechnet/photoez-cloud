
import { and, asc, eq, gt, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { blackoutDates, bookingHours, bookings, photographers } from "@/db/schema";
import { availableSlots, type Blackout, type WeeklyHours } from "./slots";
import { addDays, zonedToUtc, type LocalDate } from "./time";

// Loads a photographer's booking rules from the database and feeds them to the
// pure slot calculator in slots.ts.

export type BookingRules = {
  photographerId: string;
  timeZone: string;
  minNoticeDays: number;
  hours: WeeklyHours[];
  blackouts: Blackout[];
};

export async function loadRules(photographerId: string): Promise<BookingRules> {
  const [[studio], hours, blackouts] = await Promise.all([
    db
      .select({ timeZone: photographers.timeZone, minNoticeDays: photographers.minNoticeDays })
      .from(photographers)
      .where(eq(photographers.id, photographerId)),
    db
      .select({
        dayOfWeek: bookingHours.dayOfWeek,
        startTime: bookingHours.startTime,
        endTime: bookingHours.endTime,
        bufferMinutes: bookingHours.bufferMinutes,
      })
      .from(bookingHours)
      .where(eq(bookingHours.photographerId, photographerId)),
    db
      .select({ startDate: blackoutDates.startDate, endDate: blackoutDates.endDate })
      .from(blackoutDates)
      .where(eq(blackoutDates.photographerId, photographerId)),
  ]);
  return { photographerId, timeZone: studio.timeZone, minNoticeDays: studio.minNoticeDays, hours, blackouts };
}

// Active (not cancelled) bookings that overlap the given window.
async function busyBetween(photographerId: string, from: Date, to: Date) {
  return db
    .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.photographerId, photographerId),
        ne(bookings.status, "cancelled"),
        lt(bookings.startsAt, to),
        gt(bookings.endsAt, from),
      ),
    )
    .orderBy(asc(bookings.startsAt));
}

// Pads a day range by the longest buffer so a booking just outside it still counts.
function windowFor(rules: BookingRules, first: LocalDate, last: LocalDate) {
  const pad = Math.max(0, ...rules.hours.map((h) => h.bufferMinutes)) * 60_000 + 86_400_000;
  return {
    from: new Date(zonedToUtc(first, "00:00", rules.timeZone).getTime() - pad),
    to: new Date(zonedToUtc(addDays(last, 1), "00:00", rules.timeZone).getTime() + pad),
  };
}

export async function slotsForDate(rules: BookingRules, durationMinutes: number, date: LocalDate, now = new Date()) {
  const { from, to } = windowFor(rules, date, date);
  const busy = await busyBetween(rules.photographerId, from, to);
  return availableSlots({ ...rules, date, durationMinutes, busy, now });
}

// Every date in a month ("2026-10") that has at least one open slot.
export async function openDatesInMonth(rules: BookingRules, durationMinutes: number, month: string, now = new Date()) {
  const first = `${month}-01`;
  const dates: LocalDate[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) dates.push(d);
  const { from, to } = windowFor(rules, first, dates[dates.length - 1]);
  const busy = await busyBetween(rules.photographerId, from, to);
  return dates.filter((date) => availableSlots({ ...rules, date, durationMinutes, busy, now }).length > 0);
}

// Postgres raises exclusion_violation (23P01) when bookings_no_overlap blocks
// a double booking. Drizzle may wrap the driver error, so check the cause too.
export function isOverlapError(error: unknown): boolean {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23P01") return true;
  }
  return false;
}

// Upcoming blackout ranges for the setup page.
export async function upcomingTimeOff(photographerId: string, today: LocalDate) {
  return db
    .select()
    .from(blackoutDates)
    .where(and(eq(blackoutDates.photographerId, photographerId), gte(blackoutDates.endDate, today)))
    .orderBy(asc(blackoutDates.startDate));
}
