import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, photographers } from "@/db/schema";
import { depositCents, formatDuration, formatPrice } from "@/lib/booking/format";
import { formatDate, formatTime } from "@/lib/booking/time";
import { bookingExtras } from "@/lib/booking/session-addons";
import { requirePhotographer } from "@/lib/session";
import { siteUrl } from "@/lib/site";
import { setBookingStatus } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { BookingStatusPill } from "../status-pill";

export default async function BookingPage({ params }: PageProps<"/dashboard/bookings/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [[booking], [studio]] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.photographerId, user.id))),
    db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, user.id)),
  ]);
  if (!booking) notFound();

  const tz = studio.timeZone;
  const minutes = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000);
  const isPast = booking.endsAt < new Date();
  const extras = await bookingExtras(booking.id);
  const totalCents = booking.priceCents + booking.addonsCents;
  const details: [string, React.ReactNode][] = [
    ["When", `${formatDate(booking.startsAt, tz)}, ${formatTime(booking.startsAt, tz)} – ${formatTime(booking.endsAt, tz)}`],
    ["Length", formatDuration(minutes)],
    ["Price", formatPrice(booking.priceCents)],
    ...(extras.length > 0
      ? [
          [
            "Extras",
            <ul key="x" className="space-y-0.5">
              {extras.map((x) => (
                <li key={x.id}>
                  {x.quantity} × {x.name} · {formatPrice(x.quantity * x.priceCents)}
                </li>
              ))}
            </ul>,
          ] as [string, React.ReactNode],
          ["Total", <strong key="t">{formatPrice(totalCents)}</strong>] as [string, React.ReactNode],
        ]
      : []),
    [
      "Deposit",
      booking.depositPercent === 0
        ? "None"
        : `${formatPrice(depositCents(totalCents, booking.depositPercent))} (${booking.depositPercent}%, not collected yet)`,
    ],
    ["Email", <a key="e" href={`mailto:${booking.clientEmail}`} className="link">{booking.clientEmail}</a>],
    ["Phone", booking.clientPhone ?? "Not given"],
    ["Booked", formatDate(booking.createdAt, tz, "short")],
    ...(booking.rescheduleCount > 0
      ? [["Rescheduled", booking.rescheduleCount === 1 ? "Once, by the client" : `${booking.rescheduleCount} times, by the client`] as [string, string]]
      : []),
    ...(booking.status === "cancelled" && booking.cancelledBy
      ? [
          [
            "Cancelled",
            `By ${booking.cancelledBy === "client" ? "the client" : "you"}${
              booking.cancelledAt ? `, ${formatDate(booking.cancelledAt, tz, "short")}` : ""
            }${booking.creditDue ? ". Deposit credit owed." : ""}`,
          ] as [string, string],
        ]
      : []),
  ];

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bookings" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Bookings
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">{booking.clientName}</h1>
        <BookingStatusPill status={booking.status} />
      </div>
      <p className="mt-1 text-lg font-semibold text-muted">{booking.sessionName}</p>

      <dl className="card mt-8 divide-y divide-border px-6 sm:px-8">
        {details.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-sm font-semibold text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {booking.notes && (
          <div className="grid gap-1 py-3.5 sm:grid-cols-[8rem_1fr]">
            <dt className="text-sm font-semibold text-muted">Notes</dt>
            <dd className="whitespace-pre-line">{booking.notes}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6 flex flex-wrap items-start gap-3">
        {booking.clientId && (
          <Link href={`/dashboard/clients/${booking.clientId}`} className="btn-primary">
            Open client
          </Link>
        )}
        <a
          href={`${siteUrl}/booking/${booking.manageToken}`}
          target="_blank"
          className="rounded-full border-2 border-border px-5 py-2 text-xs font-bold tracking-wider uppercase transition hover:border-lime-ink"
        >
          Client&apos;s view
        </a>
        {booking.status === "confirmed" && isPast && (
          <ConfirmButton action={setBookingStatus.bind(null, booking.id, "completed")} pendingLabel="Saving…">
            Mark completed
          </ConfirmButton>
        )}
        {booking.status === "confirmed" && (
          <ConfirmButton
            action={setBookingStatus.bind(null, booking.id, "cancelled")}
            confirmText={`Cancel ${booking.clientName}'s booking? The time opens up for others.`}
            pendingLabel="Cancelling…"
            danger
          >
            Cancel booking
          </ConfirmButton>
        )}
        {booking.status !== "confirmed" && (
          <ConfirmButton action={setBookingStatus.bind(null, booking.id, "confirmed")} pendingLabel="Restoring…">
            {booking.status === "cancelled" ? "Restore booking" : "Mark not completed"}
          </ConfirmButton>
        )}
      </div>
      {booking.status === "confirmed" && (
        <p className="mt-4 text-sm text-muted">
          Cancelling here doesn&apos;t email the client yet (emails arrive in a later update), so let them know.
        </p>
      )}
    </div>
  );
}
