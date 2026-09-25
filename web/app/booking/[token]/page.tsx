import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { describePolicy, findClientBooking } from "@/lib/booking/client-booking";
import { depositCents, formatDuration, formatPrice } from "@/lib/booking/format";
import { clientOptions, type Blocked } from "@/lib/booking/policy";
import { formatDate, formatTime, zoneLabel } from "@/lib/booking/time";
import { LOCATION_LABELS, type ShootLocation } from "@/lib/session-types";
import { signedViewUrl } from "@/lib/storage";
import { StudioBar, StudioFooter } from "@/app/studio/[slug]/studio-bar";
import { CancelButton } from "./cancel-button";

// A client's private booking page, reached by the unguessable link they get
// after booking. It shows the booking and, within the studio's rules, lets
// them reschedule or cancel without writing to the studio.

const BLOCKED_TEXT: Record<Blocked, string | null> = {
  not_active: null,
  turned_off: "To reschedule or cancel, please contact the studio.",
  too_late: "It's too close to your session to change it online. Please contact the studio.",
  limit_reached: "You've used your free online reschedule. Please contact the studio to change it again.",
};

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

export default async function ClientBookingPage({ params, searchParams }: PageProps<"/booking/[token]">) {
  const { token } = await params;
  const { new: isNew, changed } = await searchParams;
  const row = await findClientBooking(token);
  if (!row) notFound();

  const { booking, timeZone: tz, name } = row;
  const logoUrl = row.logoKey ? await signedViewUrl(row.logoKey) : null;
  const minutes = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000);
  const cancelled = booking.status === "cancelled";
  const justBooked = isNew === "1" && !cancelled;
  const options = clientOptions(booking, row.policy, new Date());
  const policyLines = describePolicy(row.policy, booking.depositPercent);
  const blockedNote = !options.reschedule.allowed ? BLOCKED_TEXT[options.reschedule.reason] : null;
  const cancelConsequence = options.cancel.allowed
    ? booking.depositPercent === 0
      ? "Your time will be released."
      : options.cancel.creditDue
        ? "Your deposit will become a credit toward a future session."
        : `It's within ${row.policy.cancelNoticeHours} hours of your session, so your deposit is non-refundable.`
    : "";

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

        {changed === "rescheduled" && !cancelled && (
          <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
            Your session has been moved. The new time is below.
          </p>
        )}
        {cancelled && (
          <div className="mt-6 rounded-2xl bg-danger/10 px-5 py-4 text-danger">
            <p className="font-semibold">This booking was cancelled.</p>
            {booking.cancelledBy === "client" && booking.creditDue && (
              <p className="mt-1 text-sm">Your deposit will be applied as a credit toward a future session.</p>
            )}
          </div>
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

        {booking.status === "confirmed" && booking.endsAt > new Date() && (
          <section className="card mt-6 p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">Need to make a change?</h2>
            {options.reschedule.allowed || options.cancel.allowed ? (
              <>
                {policyLines.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                    {policyLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {blockedNote && <p className="mt-3 rounded-xl bg-sun/25 px-4 py-2.5 text-sm font-medium">{blockedNote}</p>}
                <div className="mt-5 flex flex-wrap items-start gap-3">
                  {options.reschedule.allowed && (
                    <Link href={`/booking/${token}/reschedule`} className="btn-primary">
                      Reschedule
                    </Link>
                  )}
                  {options.cancel.allowed && <CancelButton token={token} consequence={cancelConsequence} />}
                </div>
              </>
            ) : (
              <p className="mt-2 text-muted">{blockedNote ?? "Please contact the studio."}</p>
            )}
            {row.slug && (
              <p className="mt-5 text-sm text-muted">
                Questions?{" "}
                <Link href={`/studio/${row.slug}#contact`} className="link font-semibold">
                  Send {name} a message
                </Link>
              </p>
            )}
          </section>
        )}
      </main>

      <StudioFooter />
    </div>
  );
}
