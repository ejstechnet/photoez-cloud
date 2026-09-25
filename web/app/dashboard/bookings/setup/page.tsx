import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addons, photographers, sessionTypes } from "@/db/schema";
import { ArrowRightIcon, PlusIcon } from "@/components/icons";
import { loadRules, upcomingTimeOff } from "@/lib/booking/availability";
import { formatDuration, formatPrice } from "@/lib/booking/format";
import { localDateOf } from "@/lib/booking/time";
import { requirePhotographer } from "@/lib/session";
import { LOCATION_LABELS, type ShootLocation } from "@/lib/session-types";
import { siteUrl } from "@/lib/site";
import { signedViewUrl } from "@/lib/storage";
import { moveAddon } from "../addon-actions";
import { deleteTimeOff, moveSessionType } from "../actions";
import { MoveButtons } from "../move-buttons";
import { ConfirmButton } from "../confirm-button";
import { AvailabilityForm } from "./availability-form";
import { ClientChangesForm } from "./client-changes-form";
import { TimeOffForm } from "./time-off-form";

const NEW_STUDIO_HOURS = { start: "09:00", end: "17:00" };

function formatDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BookingSetupPage() {
  const user = await requirePhotographer();
  const [rules, sessions, [studio], addonList] = await Promise.all([
    loadRules(user.id),
    db
      .select()
      .from(sessionTypes)
      .where(eq(sessionTypes.photographerId, user.id))
      .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt)),
    db
      .select({
        slug: photographers.studioSlug,
        clientChangesEnabled: photographers.clientChangesEnabled,
        rescheduleNoticeHours: photographers.rescheduleNoticeHours,
        freeReschedules: photographers.freeReschedules,
        cancelNoticeHours: photographers.cancelNoticeHours,
      })
      .from(photographers)
      .where(eq(photographers.id, user.id)),
    db
      .select()
      .from(addons)
      .where(eq(addons.photographerId, user.id))
      .orderBy(asc(addons.sortOrder), asc(addons.createdAt)),
  ]);
  const today = localDateOf(new Date(), rules.timeZone);
  const thumbs = new Map(
    await Promise.all(
      [...sessions, ...addonList]
        .filter((s) => s.imageKey)
        .map(async (s) => [s.id, await signedViewUrl(s.imageKey!)] as const),
    ),
  );
  const timeOff = await upcomingTimeOff(user.id, today);

  // A studio that hasn't saved hours yet starts from Monday–Friday, 9 to 5.
  const firstSetup = rules.hours.length === 0;
  const days = Array.from({ length: 7 }, (_, day) => {
    const rule = rules.hours.find((h) => h.dayOfWeek === day);
    if (rule) return { open: true, start: rule.startTime, end: rule.endTime };
    return { open: firstSetup && day >= 1 && day <= 5, ...NEW_STUDIO_HOURS };
  });
  const bookingUrl = studio.slug ? `${siteUrl}/studio/${studio.slug}/book` : null;

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/bookings" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Bookings
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Booking setup</h1>
      <p className="mt-2 text-muted">
        {bookingUrl ? (
          <>
            Your booking page:{" "}
            <a href={bookingUrl} target="_blank" className="link font-semibold">
              {bookingUrl.replace(/^https?:\/\//, "")}
            </a>
          </>
        ) : (
          <>
            Set your studio page address in{" "}
            <Link href="/dashboard/settings#studio" className="link font-semibold">
              Settings
            </Link>{" "}
            to get a booking page.
          </>
        )}
      </p>

      <section className="card mt-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold">Sessions</h2>
            <p className="mt-1 text-sm text-muted">What clients can book. Use ↑ ↓ to set the order on your booking page.</p>
          </div>
          <Link href="/dashboard/bookings/sessions/new" className="btn-primary">
            <PlusIcon size={18} /> Add session
          </Link>
        </div>
        {sessions.length === 0 ? (
          <p className="mt-6 rounded-2xl border-2 border-dashed border-border px-5 py-8 text-center text-muted">
            No sessions yet. Add one so clients have something to book.
          </p>
        ) : (
          <ul className="mt-6 grid gap-3">
            {sessions.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2">
                <MoveButtons
                  label={s.name}
                  isFirst={i === 0}
                  isLast={i === sessions.length - 1}
                  moveUp={moveSessionType.bind(null, s.id, -1)}
                  moveDown={moveSessionType.bind(null, s.id, 1)}
                />
                <Link
                  href={`/dashboard/bookings/sessions/${s.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl border-2 border-border px-5 py-4 transition hover:border-lime"
                >
                  {thumbs.has(s.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs.get(s.id)} alt="" className="aspect-[2/3] w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid aspect-[2/3] w-12 shrink-0 place-items-center rounded-lg bg-background text-center text-[10px] leading-tight font-semibold text-muted">
                      No photo
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {s.name}
                      {s.hidden && (
                        <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-bold tracking-wider text-muted uppercase">
                          Hidden
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {[
                        formatDuration(s.durationMinutes),
                        formatPrice(s.priceCents),
                        s.depositPercent < 100 ? `${s.depositPercent}% deposit` : null,
                        s.location ? LOCATION_LABELS[s.location as ShootLocation] : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ArrowRightIcon size={18} className="shrink-0 text-muted transition group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="addons" className="card mt-8 scroll-mt-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold">Add-ons</h2>
            <p className="mt-1 text-sm text-muted">Extras clients can add when they book. Choose which sessions offer each one.</p>
          </div>
          <Link href="/dashboard/bookings/addons/new" className="btn-primary">
            <PlusIcon size={18} /> Add add-on
          </Link>
        </div>
        {addonList.length === 0 ? (
          <p className="mt-6 rounded-2xl border-2 border-dashed border-border px-5 py-8 text-center text-muted">
            No add-ons yet, like extra edited photos or prints.
          </p>
        ) : (
          <ul className="mt-6 grid gap-3">
            {addonList.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2">
                <MoveButtons
                  label={a.name}
                  isFirst={i === 0}
                  isLast={i === addonList.length - 1}
                  moveUp={moveAddon.bind(null, a.id, -1)}
                  moveDown={moveAddon.bind(null, a.id, 1)}
                />
                <Link
                  href={`/dashboard/bookings/addons/${a.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl border-2 border-border px-5 py-4 transition hover:border-lime"
                >
                  {thumbs.has(a.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbs.get(a.id)} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-background text-center text-[10px] leading-tight font-semibold text-muted">
                      No photo
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="text-sm text-muted">
                      {formatPrice(a.priceCents)} each · up to {a.maxQuantity}
                    </p>
                  </div>
                  <ArrowRightIcon size={18} className="shrink-0 text-muted transition group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-8 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">Hours</h2>
        <p className="mt-1 text-sm text-muted">
          Times are offered from opening, one session plus buffer apart, until the last one that ends by closing.
        </p>
        {firstSetup && (
          <p className="mt-4 rounded-xl bg-sun/30 px-4 py-3 text-sm font-medium">
            Not saved yet: clients can&apos;t book until you save your hours.
          </p>
        )}
        <div className="mt-6">
          <AvailabilityForm
            timeZone={rules.timeZone}
            minNoticeDays={rules.minNoticeDays}
            bufferMinutes={rules.hours[0]?.bufferMinutes ?? 15}
            days={days}
            allZones={Intl.supportedValuesOf("timeZone")}
          />
        </div>
      </section>

      <section className="card mt-8 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">Client changes</h2>
        <p className="mt-1 text-sm text-muted">
          Clients can move or cancel their own booking from their private link, following these rules.
        </p>
        <div className="mt-6">
          <ClientChangesForm
            enabled={studio.clientChangesEnabled}
            rescheduleNoticeHours={studio.rescheduleNoticeHours}
            freeReschedules={studio.freeReschedules}
            cancelNoticeHours={studio.cancelNoticeHours}
          />
        </div>
      </section>

      <section className="card mt-8 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">Time off</h2>
        <p className="mt-1 text-sm text-muted">Days when nothing can be booked. Existing bookings aren&apos;t affected.</p>
        <div className="mt-6">
          <TimeOffForm today={today} />
        </div>
        {timeOff.length > 0 && (
          <ul className="mt-4 divide-y divide-border rounded-2xl border-2 border-border">
            {timeOff.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold">
                    {formatDay(t.startDate)}
                    {t.endDate !== t.startDate && ` – ${formatDay(t.endDate)}`}
                  </p>
                  {t.note && <p className="text-sm text-muted">{t.note}</p>}
                </div>
                <ConfirmButton action={deleteTimeOff.bind(null, t.id)} pendingLabel="Removing…">
                  Remove
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
