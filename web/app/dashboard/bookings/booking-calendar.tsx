"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatPrice } from "@/lib/booking/format";
import { addMonths, formatDate, formatTime, localDateOf, type LocalDate } from "@/lib/booking/time";
import { inRange, monthGrid, monthTitle } from "@/lib/booking/calendar";
import { inputClass } from "@/components/form";
import { deleteBooking, rescheduleByStudio, setBookingStatus } from "./actions";

export type CalendarBooking = {
  id: string;
  startsAt: string; // ISO
  endsAt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  sessionName: string;
  status: string;
  totalCents: number;
  dueCents: number;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Chip colors by booking status.
const CHIP: Record<string, string> = {
  confirmed: "bg-violet/15 text-violet hover:bg-violet/25",
  pending_payment: "bg-sun/30 text-foreground hover:bg-sun/45",
  completed: "bg-background text-muted hover:bg-border",
};

// The studio's wall-clock time of an instant, "14:30", for the time field.
function localTime(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

// Month view of bookings, like PhotoEZ Booking's admin calendar: each session
// on its day, time off shaded, today ringed. Click a session to see and edit
// it; drag it to another day to move it. On phones the grid shows counts and
// the month's sessions are listed below.
export function BookingCalendar({
  month,
  timeZone,
  bookings,
  timeOff,
}: {
  month: string;
  timeZone: string;
  bookings: CalendarBooking[];
  timeOff: { startDate: string; endDate: string; note: string | null }[];
}) {
  const [open, setOpen] = useState<{ booking: CalendarBooking; date?: LocalDate } | null>(null);
  const [dragOver, setDragOver] = useState<LocalDate | null>(null);
  const weeks = monthGrid(month);
  const today = localDateOf(new Date(), timeZone);
  const byDay = new Map<LocalDate, CalendarBooking[]>();
  for (const b of bookings) {
    const day = localDateOf(new Date(b.startsAt), timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), b]);
  }
  const offOn = (day: LocalDate) => timeOff.find((t) => inRange(day, t.startDate, t.endDate));
  const inMonth = bookings.filter((b) => localDateOf(new Date(b.startsAt), timeZone).startsWith(month));
  const thisMonth = today.slice(0, 7);
  const canMove = (b: CalendarBooking) => b.status !== "cancelled";

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl font-bold">{monthTitle(month)}</h2>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/bookings?view=calendar&month=${addMonths(month, -1)}`} className="btn-secondary px-4 py-2" aria-label="Previous month">
            ←
          </Link>
          {month !== thisMonth && (
            <Link href="/dashboard/bookings?view=calendar" className="btn-secondary px-4 py-2">
              Today
            </Link>
          )}
          <Link href={`/dashboard/bookings?view=calendar&month=${addMonths(month, 1)}`} className="btn-secondary px-4 py-2" aria-label="Next month">
            →
          </Link>
        </div>
      </div>
      <p className="mt-1 hidden text-sm text-muted md:block">Click a session to see or change it, or drag it to another day.</p>

      <div className="card mt-4 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-background/60">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-bold tracking-wider text-muted uppercase">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day) => {
              const sessions = byDay.get(day) ?? [];
              const off = offOn(day);
              const outside = !day.startsWith(month);
              return (
                <div
                  key={day}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(day);
                  }}
                  onDragLeave={() => setDragOver((current) => (current === day ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(null);
                    const booking = bookings.find((b) => b.id === event.dataTransfer.getData("text/plain"));
                    if (booking && localDateOf(new Date(booking.startsAt), timeZone) !== day) setOpen({ booking, date: day });
                  }}
                  className={`min-h-16 border-r border-border p-1.5 transition-colors last:border-r-0 md:min-h-28 ${
                    dragOver === day ? "bg-lime/15" : off ? "bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(15_37_72/0.05)_6px_12px)]" : outside ? "bg-background/50" : ""
                  }`}
                  title={off ? `Time off${off.note ? `: ${off.note}` : ""}` : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid size-7 place-items-center rounded-full text-sm font-semibold ${
                        day === today ? "bg-lime text-brand-deep" : outside ? "text-muted/60" : ""
                      }`}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {off && <span className="hidden text-[10px] font-bold tracking-wider text-muted uppercase md:inline">Off</span>}
                    {sessions.length > 0 && (
                      <span className="grid size-5 place-items-center rounded-full bg-violet text-[10px] font-bold text-white md:hidden">
                        {sessions.length}
                      </span>
                    )}
                  </div>
                  <ul className="mt-1 hidden space-y-1 md:block">
                    {sessions.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          draggable={canMove(b)}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", b.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => setOpen({ booking: b })}
                          className={`block w-full cursor-pointer truncate rounded-lg px-1.5 py-1 text-left text-xs font-semibold transition active:cursor-grabbing ${CHIP[b.status] ?? CHIP.completed}`}
                          title={`${formatTime(new Date(b.startsAt), timeZone)} ${b.clientName} · ${b.sessionName}`}
                        >
                          {formatTime(new Date(b.startsAt), timeZone).replace(":00", "").replace(" ", "").toLowerCase()} {b.clientName}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-violet/30" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-sun/50" /> Waiting on deposit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-border" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-border bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(15_37_72/0.15)_2px_4px)]" /> Time off
        </span>
      </div>

      {/* Phones: the month's sessions as a list under the grid. */}
      <ul className="mt-6 grid gap-2 md:hidden">
        {inMonth.length === 0 && <li className="text-sm text-muted">No sessions this month.</li>}
        {inMonth.map((b) => (
          <li key={b.id}>
            <button type="button" onClick={() => setOpen({ booking: b })} className="card flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="w-12 shrink-0 text-center font-display text-xl font-bold">
                {Number(localDateOf(new Date(b.startsAt), timeZone).slice(8))}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{b.clientName}</span>
                <span className="block truncate text-sm text-muted">
                  {formatTime(new Date(b.startsAt), timeZone)} · {b.sessionName}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <BookingModal
          key={`${open.booking.id}-${open.date ?? ""}`}
          booking={open.booking}
          newDate={open.date}
          timeZone={timeZone}
          returnTo={`/dashboard/bookings?view=calendar&month=${month}`}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

// PhotoEZ Booking's booking popup: the details, a new date and time, the
// status, and Save / Delete / Close.
function BookingModal({
  booking,
  newDate,
  timeZone,
  returnTo,
  onClose,
}: {
  booking: CalendarBooking;
  // Set when the booking was dragged onto another day.
  newDate?: LocalDate;
  timeZone: string;
  returnTo: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const starts = new Date(booking.startsAt);
  const [date, setDate] = useState(newDate ?? localDateOf(starts, timeZone));
  const [time, setTime] = useState(localTime(starts, timeZone));
  const [status, setStatus] = useState(booking.status);
  const [emailClient, setEmailClient] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const moved = date !== localDateOf(starts, timeZone) || time !== localTime(starts, timeZone);
  const upcoming = starts > new Date() || moved;

  function save() {
    setMessage(null);
    startTransition(async () => {
      if (moved) {
        const result = await rescheduleByStudio(booking.id, date, time, emailClient);
        if (result.message) return setMessage(result.message);
      }
      if (status !== booking.status && (status === "confirmed" || status === "completed" || status === "cancelled")) {
        if (status === "cancelled" && !confirm(`Cancel ${booking.clientName}'s booking? They'll get an email, and the time opens up.`)) return;
        const result = await setBookingStatus(booking.id, status);
        if (result.message) return setMessage(result.message);
      }
      onClose();
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Delete ${booking.clientName}'s booking for good? This can't be undone, and the client isn't emailed.`)) return;
    startTransition(async () => {
      const result = await deleteBooking(booking.id, returnTo);
      if (result?.message) setMessage(result.message);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-deep/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-wider text-violet uppercase">{booking.sessionName}</p>
            <h2 id="booking-modal-title" className="mt-1 font-display text-2xl font-bold">
              {booking.clientName}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted hover:text-foreground">
            ×
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="font-semibold text-muted">When</dt>
          <dd>
            {formatDate(starts, timeZone)} at {formatTime(starts, timeZone)}
          </dd>
          <dt className="font-semibold text-muted">Email</dt>
          <dd className="truncate">
            <a href={`mailto:${booking.clientEmail}`} className="link">
              {booking.clientEmail}
            </a>
          </dd>
          {booking.clientPhone && (
            <>
              <dt className="font-semibold text-muted">Phone</dt>
              <dd>
                <a href={`tel:${booking.clientPhone}`} className="link">
                  {booking.clientPhone}
                </a>
              </dd>
            </>
          )}
          <dt className="font-semibold text-muted">Total</dt>
          <dd>
            {formatPrice(booking.totalCents)}
            {booking.dueCents > 0 ? (
              <span className="ml-2 rounded-full bg-sun/30 px-2 py-0.5 text-xs font-bold">{formatPrice(booking.dueCents)} due</span>
            ) : (
              <span className="ml-2 rounded-full bg-lime/20 px-2 py-0.5 text-xs font-bold text-lime-ink">Paid</span>
            )}
          </dd>
        </dl>

        {booking.status !== "cancelled" && (
          <div className={`mt-6 rounded-2xl border-2 p-4 ${newDate ? "border-lime bg-lime/10" : "border-border"}`}>
            <p className="text-sm font-semibold">{newDate ? "Move to the new day?" : "Date and time"}</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Date" />
              <input type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} className={inputClass} aria-label="Time" />
            </div>
            {moved && upcoming && booking.status === "confirmed" && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={emailClient} onChange={(e) => setEmailClient(e.target.checked)} className="size-4 accent-lime-ink" />
                Email {booking.clientName.split(" ")[0]} the new time
              </label>
            )}
          </div>
        )}

        <label className="mt-4 block">
          <span className="text-sm font-semibold">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`mt-1.5 ${inputClass}`}>
            {booking.status === "pending_payment" && <option value="pending_payment">Waiting on deposit</option>}
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled (emails the client)</option>
          </select>
        </label>

        {message && (
          <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={pending || (!moved && status === booking.status)} className="btn-primary">
            {pending ? "Saving…" : "Save"}
          </button>
          <Link href={`/dashboard/bookings/${booking.id}`} className="btn-secondary">
            Full booking
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="ml-auto rounded-full px-3 py-2 text-xs font-bold tracking-wider text-danger uppercase hover:bg-danger/10"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
