import Link from "next/link";
import {
  AI_ASSISTANT_ALLOWANCE,
  AI_PHOTO_ALLOWANCE,
  PLANS,
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_PRICES,
  TRIAL_DAYS,
  formatStorage,
  type Interval,
  type Plan,
} from "@/lib/plans";

// The three plans side by side, for the public Pricing page and Billing.
// What each includes comes from lib/plans.ts, so the cards can't drift from
// what the app actually allows.

const TAGLINES: Record<Plan, string> = {
  free: "Everything to run a small studio, free for good.",
  pro: "For busy studios: unlimited galleries, upsells, and AI.",
  studio: "More room and AI for high-volume studios, your brand only.",
};

const ACCENTS: Record<Plan, string> = {
  free: "bg-sky",
  pro: "bg-lime",
  studio: "bg-violet",
};

const n = (value: number) => value.toLocaleString("en-US");

function includes(plan: Plan): string[] {
  const limits = PLAN_LIMITS[plan];
  if (plan === "free") {
    return [
      "Studio page, online booking, and contracts",
      "Page Designer: colors, fonts, layouts",
      "Client proofing galleries with favorites",
      "Take payments, deposits, and gift cards",
      "Reviews, email reminders, and AI culling",
      `${limits.activeGalleries} active galleries`,
      `${formatStorage(limits.storageBytes)} of photo storage`,
    ];
  }
  const shared = [
    `${formatStorage(limits.storageBytes)} of photo storage`,
    `AI gallery search: ${n(AI_PHOTO_ALLOWANCE[plan])} photos a month`,
    `Studio Assistant: ${n(AI_ASSISTANT_ALLOWANCE[plan])} questions a month`,
  ];
  return plan === "pro"
    ? ["Everything in Free", "Unlimited active galleries", "Sell extra photos in galleries", ...shared]
    : ["Everything in Pro", ...shared, 'Remove "Powered by PhotoEZ Cloud"'];
}

export function PlanPrice({ plan, interval }: { plan: Plan; interval: Interval }) {
  if (plan === "free") {
    return (
      <p className="flex items-baseline gap-1">
        <span className="font-display text-5xl font-bold">$0</span>
        <span className="text-sm text-muted">forever</span>
      </p>
    );
  }
  const cents = PLAN_PRICES[plan][interval];
  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span className="font-display text-5xl font-bold">${cents / 100}</span>
        <span className="text-sm text-muted">/{interval === "month" ? "month" : "year"}</span>
      </p>
      {interval === "year" && (
        <p className="mt-1 text-xs font-semibold text-lime-ink">
          Two months free (${(PLAN_PRICES[plan].month * 12 - cents) / 100} saved)
        </p>
      )}
    </div>
  );
}

// "Monthly | Yearly" as two links, so it works without JavaScript.
export function IntervalSwitch({ interval, href }: { interval: Interval; href: (interval: Interval) => string }) {
  const pill = (value: Interval, label: string) => (
    <Link
      href={href(value)}
      scroll={false}
      aria-current={interval === value ? "true" : undefined}
      className={`rounded-full px-5 py-2 text-xs font-bold tracking-wider uppercase transition ${
        interval === value ? "bg-brand text-white" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-1">
      {pill("month", "Monthly")}
      {pill("year", "Yearly · 2 months free")}
    </div>
  );
}

export function PlanCards({
  interval,
  current,
  action,
}: {
  interval: Interval;
  // The studio's plan, marked "Your plan" (Billing only).
  current?: Plan;
  // The button under each card.
  action: (plan: Plan) => React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PLANS.map((plan) => (
        <section
          key={plan}
          className={`card relative flex flex-col overflow-hidden p-6 sm:p-8 ${plan === "pro" ? "ring-2 ring-lime" : ""}`}
        >
          <span className={`absolute inset-x-0 top-0 h-1.5 ${ACCENTS[plan]}`} aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-2xl font-bold">{PLAN_LABELS[plan]}</h3>
            {current === plan ? (
              <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-wider text-white uppercase">
                Your plan
              </span>
            ) : plan === "pro" ? (
              <span className="rounded-full bg-lime/25 px-3 py-1 text-xs font-bold tracking-wider text-lime-ink uppercase">
                {TRIAL_DAYS}-day free trial
              </span>
            ) : null}
          </div>
          <p className="mt-2 min-h-10 text-sm text-muted">{TAGLINES[plan]}</p>
          <div className="mt-5">
            <PlanPrice plan={plan} interval={interval} />
          </div>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {includes(plan).map((line) => (
              <li key={line} className="flex gap-2.5">
                <span className="mt-0.5 font-bold text-lime-ink" aria-hidden="true">
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-8">{action(plan)}</div>
        </section>
      ))}
    </div>
  );
}
