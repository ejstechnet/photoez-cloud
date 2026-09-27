import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { ArrowRightIcon } from "@/components/icons";
import { formatPrice } from "@/lib/booking/format";
import { formatDate, formatTime } from "@/lib/booking/time";
import { PERIODS, PERIOD_LABELS, parsePeriod } from "@/lib/dashboard-periods";
import { dashboardStats } from "@/lib/dashboard-stats";
import { requirePhotographer } from "@/lib/session";

// The studio at a glance, like PhotoEZ for WordPress's dashboard: revenue,
// galleries by stage, bookings, what needs attention, and the next sessions.
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requirePhotographer();
  const period = parsePeriod((await searchParams).period);
  const [studio] = await db
    .select({ timeZone: photographers.timeZone, stripeReady: photographers.stripeChargesEnabled })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const stats = await dashboardStats(user.id, studio.timeZone, period);

  const galleryCards = [
    { label: "Total galleries", value: stats.galleryCounts.total, bar: "border-b-coral", href: "/dashboard/galleries" },
    { label: "Proofing", value: stats.galleryCounts.proofing, bar: "border-b-sky", href: "/dashboard/galleries" },
    { label: "Picks submitted", value: stats.galleryCounts.submitted, bar: "border-b-violet", href: "/dashboard/galleries" },
    { label: "Ready to deliver", value: stats.galleryCounts.readyToDeliver, bar: "border-b-sun", href: "/dashboard/galleries" },
    { label: "Delivered", value: stats.galleryCounts.delivered, bar: "border-b-lime", href: "/dashboard/galleries" },
  ];
  const bookingCards = [
    { label: "Upcoming sessions", value: stats.bookingCounts.upcoming, bar: "border-b-violet", href: "/dashboard/bookings" },
    { label: "Sessions this month", value: stats.bookingCounts.thisMonth, bar: "border-b-sky", href: "/dashboard/bookings" },
    { label: "New inquiries", value: stats.newInquiries, bar: "border-b-lime", href: "/dashboard/inquiries" },
    { label: "Reviews to approve", value: stats.toApprove, bar: "border-b-sun", href: "/dashboard/reviews" },
    { label: "Clients", value: stats.clientCount, bar: "border-b-coral", href: "/dashboard/clients" },
  ];

  return (
    <>
      <p className="text-sm font-bold tracking-wider text-lime-ink uppercase">{user.businessName ?? "Your studio"}</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">
        Hello, <span className="italic">{user.name.split(" ")[0]}</span>
      </h1>

      {/* Revenue, with the period to show. */}
      <section className="relative mt-8 overflow-hidden rounded-3xl bg-brand-deep p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-lime/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-sm font-bold tracking-wider text-sky-light uppercase">Revenue</h2>
          <nav className="flex gap-1 rounded-full bg-white/10 p-1" aria-label="Revenue period">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={p === "month" ? "/dashboard" : `/dashboard?period=${p}`}
                aria-current={p === period ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wider uppercase transition ${
                  p === period ? "bg-lime text-brand-deep" : "text-white/75 hover:text-white"
                }`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </nav>
        </div>
        <div className="relative mt-6 grid gap-6 sm:grid-cols-[1.3fr_1fr_1fr_1fr] sm:items-end">
          <div>
            <p className="font-display text-5xl font-bold sm:text-6xl">{formatPrice(stats.revenue.total)}</p>
            <p className="mt-1 text-sm font-semibold text-white/70">Total collected</p>
          </div>
          <RevenueStat label="Bookings" value={stats.revenue.booking} note="Deposits and balances" />
          <RevenueStat label="Gallery extras" value={stats.revenue.gallery} note="Extra photos sold" />
          <RevenueStat label="Still owed" value={stats.revenue.owedCents} note="Balances not paid yet" accent />
        </div>
        {!studio.stripeReady && (
          <p className="relative mt-5 text-xs text-white/60">
            Revenue counts payments made online.{" "}
            <Link href="/dashboard/settings" className="font-semibold text-lime underline underline-offset-2">
              Connect Stripe
            </Link>{" "}
            to take payments.
          </p>
        )}
      </section>

      <h2 className="mt-10 text-sm font-bold tracking-wider text-muted uppercase">Galleries</h2>
      <CardRow cards={galleryCards} />

      <h2 className="mt-8 text-sm font-bold tracking-wider text-muted uppercase">Bookings &amp; clients</h2>
      <CardRow cards={bookingCards} />

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-2xl font-bold">Action required</h2>
          {stats.actions.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-lime/15 px-4 py-3 font-semibold text-lime-ink">
              ✓ All caught up! Nothing needs your attention.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {stats.actions.map((action) => (
                <li key={action.key}>
                  <Link
                    href={action.href}
                    className="group flex items-center gap-3 rounded-2xl border-2 border-border px-4 py-3 transition hover:border-lime"
                  >
                    <span className={`size-2.5 shrink-0 rounded-full ${TONES[action.tone]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{action.text}</span>
                      <span className="block truncate text-sm text-muted">{action.detail}</span>
                    </span>
                    <ArrowRightIcon size={16} className="shrink-0 text-muted transition group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">Next sessions</h2>
            <Link href="/dashboard/bookings" className="link text-sm">
              All bookings
            </Link>
          </div>
          {stats.nextSessions.length === 0 ? (
            <p className="mt-4 text-muted">No upcoming sessions yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {stats.nextSessions.map(({ booking, dueCents }) => (
                <li key={booking.id}>
                  <Link href={`/dashboard/bookings/${booking.id}`} className="flex items-center gap-4 py-3 hover:opacity-80">
                    <span className="w-14 shrink-0 rounded-xl bg-brand text-center text-white">
                      <span className="block pt-1 text-[10px] font-bold tracking-wider uppercase">
                        {formatDate(booking.startsAt, studio.timeZone, "short").split(",")[0]}
                      </span>
                      <span className="block pb-1 font-display text-xl leading-tight">
                        {new Intl.DateTimeFormat("en-US", { timeZone: studio.timeZone, day: "numeric" }).format(booking.startsAt)}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{booking.clientName}</span>
                      <span className="block truncate text-sm text-muted">
                        {booking.sessionName} ·{" "}
                        {new Intl.DateTimeFormat("en-US", { timeZone: studio.timeZone, month: "short", day: "numeric" }).format(
                          booking.startsAt,
                        )}{" "}
                        at {formatTime(booking.startsAt, studio.timeZone)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${
                        dueCents > 0 ? "bg-sun/30 text-foreground" : "bg-lime/20 text-lime-ink"
                      }`}
                    >
                      {dueCents > 0 ? `${formatPrice(dueCents)} due` : "Paid"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

const TONES = { lime: "bg-lime", sun: "bg-sun", coral: "bg-coral", sky: "bg-sky" } as const;

function RevenueStat({ label, value, note, accent = false }: { label: string; value: number; note: string; accent?: boolean }) {
  return (
    <div className="border-t border-white/15 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
      <p className={`font-display text-2xl font-bold ${accent ? "text-sun" : ""}`}>{formatPrice(value)}</p>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-white/60">{note}</p>
    </div>
  );
}

// A row of PhotoEZ-style stat cards: the number, the label, and a colored edge.
function CardRow({ cards }: { cards: { label: string; value: number; bar: string; href: string }[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={`card border-b-4 p-5 transition hover:-translate-y-1 hover:shadow-xl ${card.bar}`}
        >
          <p className="font-display text-4xl font-bold">{card.value}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{card.label}</p>
        </Link>
      ))}
    </div>
  );
}
