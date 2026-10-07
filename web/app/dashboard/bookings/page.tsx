import Link from "next/link";
import { and, asc, desc, eq, gte, lt, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { blackoutDates, bookings, photographers, sessionTypes } from "@/db/schema";
import { ArrowRightIcon } from "@/components/icons";
import { formatPrice } from "@/lib/booking/format";
import { addDays, formatDate, formatTime, localDateOf, zonedToUtc } from "@/lib/booking/time";
import { isMonth, monthGrid } from "@/lib/booking/calendar";
import { calendarBookings } from "@/lib/booking/month-bookings";
import { bookingTotal, prepaid } from "@/lib/payments/amounts";
import { releaseExpiredHolds } from "@/lib/payments/checkout";
import { requirePhotographer } from "@/lib/session";
import { BookingCalendar, type CalendarBooking } from "./booking-calendar";
import { BookingStatusPill } from "./status-pill";

const VIEWS = {
  upcoming: "Upcoming",
  calendar: "Calendar",
  past: "Past",
  cancelled: "Cancelled",
} as const;
type View = keyof typeof VIEWS;

export default async function BookingsPage({ searchParams }: PageProps<"/dashboard/bookings">) {
  const user = await requirePhotographer();
  const { view: rawView, month: rawMonth } = await searchParams;
  const view: View = rawView === "past" || rawView === "cancelled" || rawView === "calendar" ? rawView : "upcoming";
  // Checkouts abandoned past their 30-minute hold free their times first.
  await releaseExpiredHolds(user.id);
  const now = new Date();

  const where = {
    upcoming: and(ne(bookings.status, "cancelled"), gte(bookings.endsAt, now)),
    // The calendar loads its own month below.
    calendar: undefined,
    past: and(ne(bookings.status, "cancelled"), lt(bookings.endsAt, now)),
    cancelled: eq(bookings.status, "cancelled"),
  }[view];

  const [rows, [studio], sessionRows] = await Promise.all([
    view === "calendar"
      ? Promise.resolve([] as (typeof bookings.$inferSelect)[])
      : db
          .select()
          .from(bookings)
          .where(and(eq(bookings.photographerId, user.id), where))
          .orderBy(view === "upcoming" ? asc(bookings.startsAt) : desc(bookings.startsAt))
          .limit(200),
    db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, user.id)),
    db.select({ id: sessionTypes.id }).from(sessionTypes).where(eq(sessionTypes.photographerId, user.id)).limit(1),
  ]);
  const tz = studio.timeZone;

  // Calendar: the bookings and time off across the visible weeks of the month.
  const month = isMonth(rawMonth) ? rawMonth : localDateOf(now, tz).slice(0, 7);
  const calendar =
    view === "calendar"
      ? await (async () => {
          const weeks = monthGrid(month);
          const from = zonedToUtc(weeks[0][0], "00:00", tz);
          const to = zonedToUtc(addDays(weeks[weeks.length - 1][6], 1), "00:00", tz);
          const [monthBookings, timeOff] = await Promise.all([
            calendarBookings(user.id, from, to),
            db
              .select({ startDate: blackoutDates.startDate, endDate: blackoutDates.endDate, note: blackoutDates.note })
              .from(blackoutDates)
              .where(
                and(
                  eq(blackoutDates.photographerId, user.id),
                  lte(blackoutDates.startDate, weeks[weeks.length - 1][6]),
                  gte(blackoutDates.endDate, weeks[0][0]),
                ),
              ),
          ]);
          return {
            // Plain values for the interactive calendar (it runs in the browser).
            bookings: monthBookings.map(({ booking: b, paidCents }): CalendarBooking => ({
              id: b.id,
              startsAt: b.startsAt.toISOString(),
              endsAt: b.endsAt.toISOString(),
              clientName: b.clientName,
              clientEmail: b.clientEmail,
              clientPhone: b.clientPhone,
              sessionName: b.sessionName,
              status: b.status,
              totalCents: bookingTotal(b),
              dueCents: Math.max(0, bookingTotal(b) - paidCents - prepaid(b)),
            })),
            timeOff,
          };
        })()
      : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-wider text-violet uppercase">Your calendar</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Bookings</h1>
        </div>
        <Link href="/dashboard/bookings/setup" className="btn-primary">
          Booking setup <ArrowRightIcon size={18} />
        </Link>
      </div>

      {sessionRows.length === 0 && (
        <p className="mt-6 rounded-2xl bg-sun/30 px-5 py-4 font-medium">
          Clients can&apos;t book yet. Open{" "}
          <Link href="/dashboard/bookings/setup" className="link font-semibold">
            Booking setup
          </Link>{" "}
          to add your sessions and hours.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        {/* List or calendar, like PhotoEZ Booking's two views. */}
        <div className="inline-flex rounded-full border-2 border-border bg-surface p-1" role="group" aria-label="View">
          {(
            [
              ["list", "☰ List", "/dashboard/bookings"],
              ["calendar", "▦ Calendar", "/dashboard/bookings?view=calendar"],
            ] as const
          ).map(([key, label, href]) => {
            const active = key === "calendar" ? view === "calendar" : view !== "calendar";
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase transition ${
                  active ? "bg-brand text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        {view !== "calendar" && (
          <nav className="flex gap-2" aria-label="Filter bookings">
            {(["upcoming", "past", "cancelled"] as const).map((key) => (
              <Link
                key={key}
                href={key === "upcoming" ? "/dashboard/bookings" : `/dashboard/bookings?view=${key}`}
                aria-current={view === key ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-xs font-bold tracking-wider uppercase transition ${
                  view === key ? "bg-violet/15 text-violet" : "text-muted hover:text-foreground"
                }`}
              >
                {VIEWS[key]}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {calendar ? (
        <BookingCalendar month={month} timeZone={tz} bookings={calendar.bookings} timeOff={calendar.timeOff} />
      ) : rows.length === 0 ? (
        <p className="card mt-6 border-2 border-dashed px-6 py-14 text-center text-muted">
          {view === "upcoming" ? "No upcoming bookings yet." : `No ${VIEWS[view].toLowerCase()} bookings.`}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {rows.map((b) => (
            <li key={b.id}>
              <Link
                href={`/dashboard/bookings/${b.id}`}
                className="card group flex items-center gap-5 px-5 py-4 transition hover:-translate-y-0.5 hover:border-lime hover:shadow-lg"
              >
                <div className="w-16 shrink-0 rounded-2xl bg-violet/15 py-2 text-center">
                  <p className="text-[11px] font-bold tracking-wider text-violet uppercase">
                    {new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short" }).format(b.startsAt)}
                  </p>
                  <p className="font-display text-2xl leading-tight font-bold">
                    {new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(b.startsAt)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.clientName}</p>
                  <p className="truncate text-sm text-muted">
                    {b.sessionName} · {formatDate(b.startsAt, tz, "short")} · {formatTime(b.startsAt, tz)} ·{" "}
                    {formatPrice(bookingTotal(b))}
                    {b.status === "cancelled" && b.cancelledBy === "client" && " · Cancelled by client"}
                    {b.creditDue && " · Credit owed"}
                    {b.status !== "cancelled" && b.rescheduleCount > 0 && " · Rescheduled"}
                  </p>
                </div>
                <BookingStatusPill status={b.status} />
                <ArrowRightIcon size={18} className="hidden shrink-0 text-muted transition group-hover:translate-x-1 sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
