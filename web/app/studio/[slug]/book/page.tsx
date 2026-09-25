import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers, sessionTypes } from "@/db/schema";
import { addonsForSession } from "@/lib/booking/session-addons";
import { loadRules, openDatesInMonth, slotsForDate } from "@/lib/booking/availability";
import { formatDuration, formatPrice } from "@/lib/booking/format";
import { addMonths, formatDate, formatTime, localDateOf, zoneLabel } from "@/lib/booking/time";
import { LOCATION_LABELS, type ShootLocation } from "@/lib/session-types";
import { richTextHtml, richTextToPlain } from "@/lib/rich-text";
import { signedViewUrl } from "@/lib/storage";
import { StudioBar, StudioFooter } from "../studio-bar";
import { BookingForm } from "./booking-form";
import { Calendar } from "./calendar";
import { SessionPicker } from "./session-picker";

// Public booking page: pick a session, a day, and a time, then enter your
// details. Each choice is a link that adds to the URL
// (?session=…&month=…&date=…&time=…), so the page is plain server-rendered
// HTML and the back button works the way people expect.

const MONTHS_AHEAD = 12;

async function findStudio(slug: string) {
  const [studio] = await db
    .select({
      id: photographers.id,
      name: photographers.name,
      businessName: photographers.businessName,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
    })
    .from(photographers)
    .where(eq(photographers.studioSlug, slug.toLowerCase()));
  return studio ?? null;
}

export async function generateMetadata({ params }: PageProps<"/studio/[slug]/book">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await findStudio(slug);
  return { title: studio ? `Book a session · ${studio.businessName ?? studio.name}` : "Studio not found · PhotoEZ Cloud" };
}

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function BookPage({ params, searchParams }: PageProps<"/studio/[slug]/book">) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase();
  const query = await searchParams;
  const studio = await findStudio(slug);
  if (!studio) notFound();

  const name = studio.businessName ?? studio.name;
  const [rules, sessions, logoUrl] = await Promise.all([
    loadRules(studio.id),
    db
      .select()
      .from(sessionTypes)
      .where(and(eq(sessionTypes.photographerId, studio.id), eq(sessionTypes.hidden, false)))
      .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt)),
    studio.logoKey ? signedViewUrl(studio.logoKey) : Promise.resolve(null),
  ]);
  const tz = rules.timeZone;
  const now = new Date();
  const thisMonth = localDateOf(now, tz).slice(0, 7);
  const lastMonth = addMonths(thisMonth, MONTHS_AHEAD);

  const session = sessions.find((s) => s.id === one(query.session)) ?? null;
  const photoUrls = new Map(
    await Promise.all(
      sessions
        .filter((s) => s.imageKey)
        .map(async (s) => [s.id, await signedViewUrl(s.imageKey!)] as const),
    ),
  );

  // The month on show: from the chosen date, the URL, or the first month with openings.
  const dateParam = one(query.date);
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const monthParam = one(query.month);
  let month =
    date?.slice(0, 7) ??
    (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : null) ??
    thisMonth;
  if (month < thisMonth || month > lastMonth) month = thisMonth;

  let openDates: string[] = [];
  if (session) {
    openDates = await openDatesInMonth(rules, session.durationMinutes, month, now);
    // No month chosen yet and nothing left this month: jump ahead to the next opening.
    for (let tries = 0; !monthParam && !date && openDates.length === 0 && tries < 2; tries++) {
      month = addMonths(month, 1);
      openDates = await openDatesInMonth(rules, session.durationMinutes, month, now);
    }
  }

  const slots = session && date && openDates.includes(date) ? await slotsForDate(rules, session.durationMinutes, date, now) : [];
  const timeParam = one(query.time);
  const time = slots.find((slot) => slot.toISOString() === timeParam) ?? null;
  const sessionAddons = session && time ? await addonsForSession(session.id) : [];

  const href = (params: { session?: string; month?: string; date?: string; time?: string }) => {
    const search = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
    return `/studio/${slug}/book${search.size > 0 ? `?${search}` : ""}`;
  };

  const bookingOpen = sessions.length > 0 && rules.hours.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <StudioBar slug={slug} name={name} logoUrl={logoUrl} logoBg={studio.logoBg} />

      <main className={`mx-auto w-full flex-1 px-4 py-10 ${session ? "max-w-3xl" : "max-w-5xl"}`}>
        <p className="text-sm font-bold tracking-wider text-lime-ink uppercase">{name}</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Book a session</h1>

        {!bookingOpen ? (
          <div className="card mt-8 p-8 text-center">
            <p className="font-display text-2xl font-bold">Online booking isn&apos;t open yet</p>
            <p className="mt-2 text-muted">Send {name} a message and they&apos;ll help you find a time.</p>
            <Link href={`/studio/${slug}#contact`} className="btn-primary mt-6">
              Get in touch
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Step 1: session */}
            <section className="card p-6 sm:p-8">
              <StepTitle n={1} done={Boolean(session)}>
                Choose a session
              </StepTitle>
              {session ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-lime/15 px-5 py-4">
                  <div>
                    <p className="font-semibold">{session.name}</p>
                    <p className="text-sm text-muted">{sessionFacts(session)}</p>
                  </div>
                  <Link href={href({})} scroll={false} className="link text-sm font-semibold">
                    Change
                  </Link>
                </div>
              ) : (
                <div className="mt-6">
                  <SessionPicker
                    sessions={sessions.map((s) => ({
                      id: s.id,
                      name: s.name,
                      // The short description, or the start of the full one.
                      summary: s.shortDescription ?? (s.description ? richTextToPlain(s.description).slice(0, 200) : null),
                      facts: [
                        formatDuration(s.durationMinutes),
                        s.location ? LOCATION_LABELS[s.location as ShootLocation] : null,
                        s.photosIncluded ? `${s.photosIncluded} edited photos` : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      price: formatPrice(s.priceCents),
                      photoUrl: photoUrls.get(s.id) ?? null,
                      descriptionHtml: richTextHtml(s.description),
                      href: href({ session: s.id }),
                    }))}
                  />
                </div>
              )}
            </section>

            {/* Step 2: day and time */}
            {session && (
              <section className="card p-6 sm:p-8">
                <StepTitle n={2} done={Boolean(time)}>
                  Pick a day and time
                </StepTitle>
                <div className="mt-4 grid gap-6 sm:grid-cols-[1fr_12rem]">
                  <Calendar
                    month={month}
                    openDates={openDates}
                    selected={date}
                    prevHref={month > thisMonth ? href({ session: session.id, month: addMonths(month, -1) }) : null}
                    nextHref={month < lastMonth ? href({ session: session.id, month: addMonths(month, 1) }) : null}
                    dayHref={(d) => href({ session: session.id, date: d })}
                  />
                  <div>
                    {date && openDates.includes(date) ? (
                      <>
                        <p className="text-sm font-semibold">
                          {formatDate(slots[0] ?? now, tz, "short").replace(/, \d{4}$/, "")}
                        </p>
                        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-1">
                          {slots.map((slot) => {
                            const chosen = time?.getTime() === slot.getTime();
                            return (
                              <li key={slot.toISOString()}>
                                <Link
                                  href={href({ session: session.id, date, time: slot.toISOString() })}
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
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p className="text-sm text-muted">
                        {openDates.length > 0 ? "Pick a highlighted day to see times." : "No openings this month."}
                      </p>
                    )}
                    <p className="mt-4 text-xs text-muted">Times are {zoneLabel(now, tz)} ({tz.replaceAll("_", " ")}).</p>
                  </div>
                </div>
              </section>
            )}

            {/* Steps 3–4: extras (when the session has any) and the client's details */}
            {session && time && (
              <BookingForm
                slug={slug}
                sessionTypeId={session.id}
                startsAt={time.toISOString()}
                backHref={href({ session: session.id, month })}
                priceCents={session.priceCents}
                depositPercent={session.depositPercent}
                addons={sessionAddons}
                summary={
                  <>
                    <p className="font-semibold">
                      {session.name} · {formatDate(time, tz)}
                    </p>
                    <p className="text-sm text-muted">
                      {formatTime(time, tz)} –{" "}
                      {formatTime(new Date(time.getTime() + session.durationMinutes * 60_000), tz)} {zoneLabel(time, tz)}
                    </p>
                  </>
                }
              />
            )}
          </div>
        )}
      </main>

      <StudioFooter />
    </div>
  );
}

function sessionFacts(s: { durationMinutes: number; priceCents: number; location: string | null; photosIncluded: number | null }) {
  return [
    formatDuration(s.durationMinutes),
    formatPrice(s.priceCents),
    s.location ? LOCATION_LABELS[s.location as ShootLocation] : null,
    s.photosIncluded ? `${s.photosIncluded} edited photos` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function StepTitle({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-2xl font-bold">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full font-sans text-sm font-bold ${
          done ? "bg-lime text-brand-deep" : "bg-brand text-white"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {children}
    </h2>
  );
}
