import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, photographers, sessionTypes } from "@/db/schema";
import { depositCents, formatDuration, formatPrice } from "@/lib/booking/format";
import { formatDate, formatTime, zoneLabel } from "@/lib/booking/time";
import { LOCATION_LABELS, type ShootLocation } from "@/lib/session-types";
import { signedViewUrl } from "@/lib/storage";
import { StudioBar, StudioFooter } from "@/app/studio/[slug]/studio-bar";

// A client's private booking page, reached by the unguessable link they get
// after booking. It shows the booking; changes go through the studio for now.

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

export default async function ClientBookingPage({ params, searchParams }: PageProps<"/booking/[token]">) {
  const { token } = await params;
  const { new: isNew } = await searchParams;
  if (!/^[\w-]{20,64}$/.test(token)) notFound();

  const [row] = await db
    .select({
      booking: bookings,
      location: sessionTypes.location,
      studioName: photographers.name,
      businessName: photographers.businessName,
      slug: photographers.studioSlug,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
      timeZone: photographers.timeZone,
    })
    .from(bookings)
    .innerJoin(photographers, eq(photographers.id, bookings.photographerId))
    .leftJoin(sessionTypes, eq(sessionTypes.id, bookings.sessionTypeId))
    .where(eq(bookings.manageToken, token));
  if (!row) notFound();

  const { booking, timeZone: tz } = row;
  const name = row.businessName ?? row.studioName;
  const logoUrl = row.logoKey ? await signedViewUrl(row.logoKey) : null;
  const minutes = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000);
  const cancelled = booking.status === "cancelled";
  const justBooked = isNew === "1" && !cancelled;

  const details: [string, string][] = [
    ["Session", booking.sessionName],
    ["Date", formatDate(booking.startsAt, tz)],
    [
      "Time",
      `${formatTime(booking.startsAt, tz)} – ${formatTime(booking.endsAt, tz)} ${zoneLabel(booking.startsAt, tz)} (${formatDuration(minutes)})`,
    ],
    ...(row.location ? [["Where", LOCATION_LABELS[row.location as ShootLocation]] as [string, string]] : []),
    ["Price", formatPrice(booking.priceCents)],
    ...(booking.depositPercent > 0 && booking.depositPercent < 100
      ? [["Deposit", `${formatPrice(depositCents(booking.priceCents, booking.depositPercent))} (the studio will let you know how to pay)`] as [string, string]]
      : []),
    ["Name", booking.clientName],
    ["Email", booking.clientEmail],
  ];

  return (
    <div className="flex flex-1 flex-col">
      {row.slug ? (
        <StudioBar slug={row.slug} name={name} logoUrl={logoUrl} logoBg={row.logoBg} />
      ) : (
        <div className="bg-brand-deep px-4 py-4 font-display text-lg text-white">{name}</div>
      )}

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        {justBooked ? (
          <div className="text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-lime text-3xl font-bold text-brand-deep">
              ✓
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">You&apos;re booked!</h1>
            <p className="mt-2 text-muted">
              Save this page: it&apos;s your link to your booking with {name}.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-bold tracking-wider text-lime-ink uppercase">{name}</p>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Your booking</h1>
          </>
        )}

        {cancelled && (
          <p className="mt-6 rounded-2xl bg-danger/10 px-5 py-4 font-semibold text-danger">
            This booking was cancelled.
          </p>
        )}
        {booking.status === "completed" && (
          <p className="mt-6 rounded-2xl bg-lime/15 px-5 py-4 font-semibold">This session is complete. Thank you!</p>
        )}

        <dl className="card mt-8 divide-y divide-border px-6 sm:px-8">
          {details.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-3.5 sm:grid-cols-[7rem_1fr]">
              <dt className="text-sm font-semibold text-muted">{label}</dt>
              <dd className={cancelled ? "line-through decoration-muted/60" : undefined}>{value}</dd>
            </div>
          ))}
        </dl>

        {!cancelled && row.slug && (
          <p className="mt-6 text-center text-sm text-muted">
            Need to change or cancel?{" "}
            <Link href={`/studio/${row.slug}#contact`} className="link font-semibold">
              Send {name} a message
            </Link>
            .
          </p>
        )}
      </main>

      <StudioFooter />
    </div>
  );
}
