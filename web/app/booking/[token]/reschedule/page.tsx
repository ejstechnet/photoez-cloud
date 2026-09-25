import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadRules, openDatesInMonth, slotsForDate } from "@/lib/booking/availability";
import { findClientBooking } from "@/lib/booking/client-booking";
import { clientOptions } from "@/lib/booking/policy";
import { addMonths, formatDate, formatTime, localDateOf, zoneLabel } from "@/lib/booking/time";
import { signedViewUrl } from "@/lib/storage";
import { Calendar } from "@/app/studio/[slug]/book/calendar";
import { StudioBar, StudioFooter } from "@/app/studio/[slug]/studio-bar";
import { ConfirmReschedule } from "./confirm-reschedule";

// Pick a new day and time for an existing booking. Same calendar as booking,
// for the same session length, with the client's own current time left open.

export const metadata: Metadata = { title: "Reschedule your booking", robots: { index: false } };

const MONTHS_AHEAD = 12;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function ReschedulePage({ params, searchParams }: PageProps<"/booking/[token]/reschedule">) {
  const { token } = await params;
  const query = await searchParams;
  const row = await findClientBooking(token);
  if (!row) notFound();
  const { booking, name } = row;

  const now = new Date();
  if (!clientOptions(booking, row.policy, now).reschedule.allowed) redirect(`/booking/${token}`);

  const rules = await loadRules(booking.photographerId);
  const tz = rules.timeZone;
  const minutes = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000);
  const thisMonth = localDateOf(now, tz).slice(0, 7);
  const lastMonth = addMonths(thisMonth, MONTHS_AHEAD);

  const dateParam = one(query.date);
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const monthParam = one(query.month);
  let month =
    date?.slice(0, 7) ??
    (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : null) ??
    localDateOf(booking.startsAt, tz).slice(0, 7);
  if (month < thisMonth || month > lastMonth) month = thisMonth;

  const openDates = await openDatesInMonth(rules, minutes, month, now, booking.id);
  const slots = date && openDates.includes(date) ? await slotsForDate(rules, minutes, date, now, booking.id) : [];
  const time = slots.find((slot) => slot.toISOString() === one(query.time)) ?? null;
  const base = `/booking/${token}/reschedule`;
  const href = (p: { month?: string; date?: string; time?: string }) => {
    const search = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => Boolean(e[1])));
    return search.size > 0 ? `${base}?${search}` : base;
  };
  const logoUrl = row.logoKey ? await signedViewUrl(row.logoKey) : null;

  return (
    <div className="flex flex-1 flex-col">
      {row.slug ? (
        <StudioBar slug={row.slug} name={name} logoUrl={logoUrl} logoBg={row.logoBg} />
      ) : (
        <div className="bg-brand-deep px-4 py-4 font-display text-lg text-white">{name}</div>
      )}

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Link href={`/booking/${token}`} className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
          ← Your booking
        </Link>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Pick a new time</h1>
        <p className="mt-2 text-muted">
          {booking.sessionName}, currently {formatDate(booking.startsAt, tz)} at {formatTime(booking.startsAt, tz)}.
        </p>

        <section className="card mt-8 p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
            <Calendar
              month={month}
              openDates={openDates}
              selected={date}
              prevHref={month > thisMonth ? href({ month: addMonths(month, -1) }) : null}
              nextHref={month < lastMonth ? href({ month: addMonths(month, 1) }) : null}
              dayHref={(d) => href({ date: d })}
            />
            <div>
              {date && slots.length > 0 ? (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                  {slots.map((slot) => {
                    const chosen = time?.getTime() === slot.getTime();
                    const current = slot.getTime() === booking.startsAt.getTime();
                    return (
                      <li key={slot.toISOString()}>
                        {current ? (
                          <span className="block rounded-xl border-2 border-dashed border-border px-3 py-2 text-center text-sm text-muted">
                            {formatTime(slot, tz)} (current)
                          </span>
                        ) : (
                          <Link
                            href={href({ date, time: slot.toISOString() })}
                            scroll={false}
                            aria-current={chosen ? "true" : undefined}
                            className={`block rounded-xl border-2 px-3 py-2 text-center font-semibold transition ${
                              chosen
                                ? "border-lime-ink bg-lime text-brand-deep"
                                : "border-border hover:border-lime-ink hover:bg-lime/15"
                            }`}
                          >
                            {formatTime(slot, tz)}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  {openDates.length > 0 ? "Pick a highlighted day to see times." : "No openings this month."}
                </p>
              )}
              <p className="mt-4 text-xs text-muted">Times are {zoneLabel(now, tz)} ({tz.replaceAll("_", " ")}).</p>
            </div>
          </div>
        </section>

        {time && (
          <section className="card mt-6 p-6 sm:p-8">
            <p className="font-semibold">
              Move to {formatDate(time, tz)} at {formatTime(time, tz)} {zoneLabel(time, tz)}?
            </p>
            <p className="mt-1 text-sm text-muted">
              {booking.rescheduleCount + 1 >= row.policy.freeReschedules
                ? "This uses your free online reschedule."
                : "You can still reschedule online again after this."}
            </p>
            <div className="mt-4">
              <ConfirmReschedule token={token} startsAt={time.toISOString()} backHref={href({ month })} />
            </div>
          </section>
        )}
      </main>

      <StudioFooter />
    </div>
  );
}
