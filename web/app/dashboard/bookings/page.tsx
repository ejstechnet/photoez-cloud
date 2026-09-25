import Link from "next/link";
import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { bookings, photographers, sessionTypes } from "@/db/schema";
import { ArrowRightIcon } from "@/components/icons";
import { formatPrice } from "@/lib/booking/format";
import { formatDate, formatTime } from "@/lib/booking/time";
import { requirePhotographer } from "@/lib/session";
import { BookingStatusPill } from "./status-pill";

const VIEWS = {
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
} as const;
type View = keyof typeof VIEWS;

export default async function BookingsPage({ searchParams }: PageProps<"/dashboard/bookings">) {
  const user = await requirePhotographer();
  const { view: rawView } = await searchParams;
  const view: View = rawView === "past" || rawView === "cancelled" ? rawView : "upcoming";
  const now = new Date();

  const where = {
    upcoming: and(ne(bookings.status, "cancelled"), gte(bookings.endsAt, now)),
    past: and(ne(bookings.status, "cancelled"), lt(bookings.endsAt, now)),
    cancelled: eq(bookings.status, "cancelled"),
  }[view];

  const [rows, [studio], sessionRows] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(and(eq(bookings.photographerId, user.id), where))
      .orderBy(view === "upcoming" ? asc(bookings.startsAt) : desc(bookings.startsAt))
      .limit(200),
    db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, user.id)),
    db.select({ id: sessionTypes.id }).from(sessionTypes).where(eq(sessionTypes.photographerId, user.id)).limit(1),
  ]);
  const tz = studio.timeZone;

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

      <nav className="mt-8 flex gap-2" aria-label="Filter bookings">
        {(Object.keys(VIEWS) as View[]).map((key) => (
          <Link
            key={key}
            href={key === "upcoming" ? "/dashboard/bookings" : `/dashboard/bookings?view=${key}`}
            aria-current={view === key ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-xs font-bold tracking-wider uppercase transition ${
              view === key ? "bg-brand text-white" : "border-2 border-border text-muted hover:text-foreground"
            }`}
          >
            {VIEWS[key]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
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
                    {formatPrice(b.priceCents)}
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
