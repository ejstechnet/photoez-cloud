import { cookies } from "next/headers";
import { FRIEND_COOKIE, referringClient } from "@/lib/client-referrals";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingFields, giftCards, photographers, sessionTypes } from "@/db/schema";
import { fieldsForSession } from "@/lib/booking/fields";
import { addonsForSession } from "@/lib/booking/session-addons";
import { loadRules, openDatesInMonth, slotsForDate } from "@/lib/booking/availability";
import { formatDuration, formatPrice } from "@/lib/booking/format";
import { currentPrice } from "@/lib/booking/pricing";
import { addMonths, formatDate, formatTime, localDateOf, zoneLabel } from "@/lib/booking/time";
import { LOCATION_LABELS, type ShootLocation } from "@/lib/session-types";
import { richTextHtml, richTextToPlain } from "@/lib/rich-text";
import { signedViewUrl } from "@/lib/storage";
import { StudioBar, StudioFooter } from "../studio-bar";
import { BookingForm } from "./booking-form";
import { textingOn } from "@/lib/sms/send";
import { BookingSteps } from "./booking-steps";
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
      inspoMode: photographers.inspoMode,
      giftCardsEnabled: photographers.giftCardsEnabled,
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
  // Sent by a client's share link (/studio/<slug>/friend/<code>)?
  const friendCode = (await cookies()).get(FRIEND_COOKIE)?.value ?? null;
  const referrer = await referringClient(studio.id, friendCode);
  const friend = referrer
    ? { code: friendCode!, name: referrer.name.trim().split(/\s+/)[0], discountCents: referrer.discountCents }
    : null;
  // The gift card field shows when the studio sells cards or has any active ones.
  const giftCardsOn =
    studio.giftCardsEnabled ||
    (
      await db
        .select({ id: giftCards.id })
        .from(giftCards)
        .where(and(eq(giftCards.photographerId, studio.id), eq(giftCards.status, "active")))
        .limit(1)
    ).length > 0;
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
  const today = localDateOf(now, tz);
  // Special prices apply by the studio's own calendar day.
  const priceOf = (s: (typeof sessions)[number]) => currentPrice(s, today);
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
  // The chosen day, when it really has times left.
  const validDate = date && slots.length > 0 ? date : null;
  const timeParam = one(query.time);
  const time = slots.find((slot) => slot.toISOString() === timeParam) ?? null;
  const sessionAddons = session ? await addonsForSession(session.id) : [];
  const hasExtras = session ? sessionAddons.length > 0 : true;
  const questions =
    session && time
      ? fieldsForSession(
          await db
            .select({
              id: bookingFields.id,
              label: bookingFields.label,
              type: bookingFields.type,
              options: bookingFields.options,
              required: bookingFields.required,
              sessionTypeIds: bookingFields.sessionTypeIds,
            })
            .from(bookingFields)
            .where(eq(bookingFields.photographerId, studio.id))
            .orderBy(asc(bookingFields.sortOrder), asc(bookingFields.createdAt)),
          session.id,
        )
      : [];

  const href = (params: { session?: string; month?: string; date?: string; time?: string }) => {
    const search = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
    return `/studio/${slug}/book${search.size > 0 ? `?${search}` : ""}`;
  };

  const bookingOpen = sessions.length > 0 && rules.hours.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <StudioBar slug={slug} name={name} logoUrl={logoUrl} logoBg={studio.logoBg} bookButton={false} />

      <main className={`mx-auto w-full flex-1 px-4 py-10 ${session ? "max-w-3xl" : "max-w-7xl"}`}>
        <p className="text-sm font-bold tracking-wider text-lime-ink uppercase">{name}</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Book a session</h1>
        {one(query.payment) === "cancelled" && (
          <p className="mt-4 rounded-2xl bg-sun/30 px-5 py-4 font-semibold">
            Your payment was cancelled, so that time wasn&apos;t booked. You can pick a time again below.
          </p>
        )}

        {!bookingOpen ? (
          <div className="card mt-8 p-8 text-center">
            <p className="font-display text-2xl font-bold">Online booking isn&apos;t open yet</p>
            <p className="mt-2 text-muted">Send {name} a message and they&apos;ll help you find a time.</p>
            <Link href={`/studio/${slug}#contact`} className="btn-primary mt-6">
              Get in touch
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            {/* One step at a time, like PhotoEZ Booking's step form. */}
            {!(session && time) && (
              <BookingSteps current={!session ? "session" : !validDate ? "date" : "time"} hasExtras={hasExtras} />
            )}

            {/* The choices so far, each with its own Change link. */}
            {session && !time && (
              <ul className="mt-6 flex flex-wrap gap-2 text-sm">
                <Choice label={session.name} changeHref={href({})} />
                {validDate && <Choice label={formatDate(zonedNoon(validDate), tz)} changeHref={href({ session: session.id, month })} />}
              </ul>
            )}

            {!session ? (
              <section className="card mt-6 p-6 sm:p-8">
                <StepTitle>Choose a session</StepTitle>
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
                      price: formatPrice(priceOf(s).priceCents),
                      wasPrice: priceOf(s).wasCents !== null ? formatPrice(priceOf(s).wasCents!) : null,
                      photoUrl: photoUrls.get(s.id) ?? null,
                      descriptionHtml: richTextHtml(s.description),
                      href: href({ session: s.id }),
                    }))}
                  />
                </div>
              </section>
            ) : !validDate ? (
              <section className="card mt-6 p-6 sm:p-8">
                <StepTitle>Pick a day</StepTitle>
                <p className="mt-1 text-sm text-muted">
                  {sessionFacts({ ...session, priceCents: priceOf(session).priceCents })}. Highlighted days have openings.
                </p>
                <div className="mx-auto mt-6 max-w-md">
                  <Calendar
                    month={month}
                    openDates={openDates}
                    selected={null}
                    prevHref={month > thisMonth ? href({ session: session.id, month: addMonths(month, -1) }) : null}
                    nextHref={month < lastMonth ? href({ session: session.id, month: addMonths(month, 1) }) : null}
                    dayHref={(d) => href({ session: session.id, date: d })}
                  />
                  {openDates.length === 0 && <p className="mt-4 text-center text-sm text-muted">No openings this month. Try the next one.</p>}
                </div>
                <StepBack href={href({})}>Choose a different session</StepBack>
              </section>
            ) : !time ? (
              <section className="card mt-6 p-6 sm:p-8">
                <StepTitle>Pick a time</StepTitle>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(zonedNoon(validDate), tz)} · times are {zoneLabel(now, tz)} ({tz.replaceAll("_", " ")})
                </p>
                <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <li key={slot.toISOString()}>
                      <Link
                        href={href({ session: session.id, date: validDate, time: slot.toISOString() })}
                        className="block rounded-2xl border-2 border-border px-3 py-3 text-center font-semibold transition hover:border-lime-ink hover:bg-lime/15"
                      >
                        {formatTime(slot, tz)}
                      </Link>
                    </li>
                  ))}
                </ul>
                <StepBack href={href({ session: session.id, month })}>Pick another day</StepBack>
              </section>
            ) : (
              <BookingForm
                slug={slug}
                sessionTypeId={session.id}
                startsAt={time.toISOString()}
                backHref={href({ session: session.id, date: validDate })}
                changeSessionHref={href({})}
                changeDateHref={href({ session: session.id, month })}
                priceCents={priceOf(session).priceCents}
                depositPercent={session.depositPercent}
                addons={sessionAddons}
                questions={questions}
                inspoMode={studio.inspoMode}
                giftCardsOn={giftCardsOn}
                textsOn={await textingOn(studio.id)}
                friend={friend}
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

      <StudioFooter studioId={studio.id} />
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

function StepTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl font-bold sm:text-3xl">{children}</h2>;
}

function StepBack({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-8 inline-flex items-center gap-2 text-sm font-bold tracking-wider text-link uppercase hover:underline">
      ← {children}
    </Link>
  );
}

function Choice({ label, changeHref }: { label: string; changeHref: string }) {
  return (
    <li className="flex items-center gap-2 rounded-full bg-lime/15 py-1.5 pr-2 pl-3.5">
      <span className="font-semibold">✓ {label}</span>
      <Link href={changeHref} className="rounded-full px-2 py-0.5 text-xs font-bold tracking-wider text-link uppercase hover:bg-surface">
        Change
      </Link>
    </li>
  );
}

// Noon on a studio calendar day, for showing that day's date in its time zone.
function zonedNoon(day: string) {
  return new Date(`${day}T12:00:00Z`);
}
