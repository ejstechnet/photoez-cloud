import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { IntervalSwitch, PlanCards } from "@/components/plan-cards";
import { assistantAllowance } from "@/lib/ai/assistant/run";
import { photoAllowance } from "@/lib/gallery-tagging";
import { planUsage } from "@/lib/plan-usage";
import { PLAN_LABELS, TRIAL_AI_ASSISTANT_ALLOWANCE, TRIAL_AI_PHOTO_ALLOWANCE, TRIAL_DAYS, formatStorage, hasFeature, trialDaysLeft, type Interval } from "@/lib/plans";
import { requirePhotographer } from "@/lib/session";
import { refreshSubscription, scheduledChange } from "@/lib/billing";
import { stripeConfigured } from "@/lib/stripe";
import { manageBilling, subscribe } from "./actions";
import { BrandingToggle } from "./branding-toggle";
import { CopyLink } from "@/components/copy-link";
import { referralSummary } from "@/lib/referrals";
import { siteUrl } from "@/lib/site";
import { REFERRAL_DISCOUNT_PERCENT, REFERRAL_YEARLY_CAP, referralRewardCents } from "@/lib/plans";

export const metadata: Metadata = { title: "Billing" };

// Settings > Billing: the studio's PhotoEZ Cloud plan, what it's using, and
// the plans to choose from (lib/billing.ts does the Stripe side).
export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const user = await requirePhotographer();
  const params = await searchParams;
  if (stripeConfigured()) await refreshSubscription(user.id).catch(() => {});
  const [studio] = await db
    .select({
      subscribedPlan: photographers.plan,
      trialEndsAt: photographers.trialEndsAt,
      subscriptionId: photographers.subscriptionId,
      status: photographers.subscriptionStatus,
      planInterval: photographers.planInterval,
      periodEnd: photographers.currentPeriodEnd,
      cancelling: photographers.cancelAtPeriodEnd,
      hideBranding: photographers.hideBranding,
      timeZone: photographers.timeZone,
    })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const [usage, photosAi, assistant, referrals, change] = await Promise.all([
    planUsage(user.id),
    photoAllowance(user.id),
    assistantAllowance(user.id),
    referralSummary(user.id),
    stripeConfigured() ? scheduledChange(user.id).catch(() => null) : null,
  ]);
  const plan = usage.plan;
  const trialLeft = studio.subscribedPlan === "free" ? trialDaysLeft(studio.trialEndsAt) : 0;
  const subscribed =
    studio.subscriptionId !== null && studio.status !== "canceled" && studio.status !== "incomplete_expired";
  const complimentary = studio.subscribedPlan !== "free" && !subscribed;
  const interval: Interval =
    params.interval === "year" || params.interval === "month"
      ? params.interval
      : studio.planInterval === "year"
        ? "year"
        : "month";
  const date = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: studio.timeZone });

  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-sky uppercase">Studio settings</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Billing</h1>

      {params.welcome === "1" && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold text-lime-ink">
          Thank you! You&rsquo;re on the {PLAN_LABELS[plan]} plan now.
        </p>
      )}
      {params.error === "stripe" && (
        <p className="mt-6 rounded-2xl bg-coral/15 px-5 py-4 font-semibold text-danger">
          Billing isn&rsquo;t set up on this server yet.
        </p>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">Your plan</h2>
            <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-wider text-white uppercase">
              {PLAN_LABELS[plan]}
              {trialLeft > 0 && " trial"}
            </span>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {trialLeft > 0 && studio.trialEndsAt && (
              <p>
                Your free Pro trial has <strong>{trialLeft === 1 ? "1 day" : `${trialLeft} days`}</strong> left (until{" "}
                {date(studio.trialEndsAt)}). Choose a plan below to keep Pro; otherwise your studio moves to Free and
                nothing is deleted. During the trial, AI is capped at {TRIAL_AI_PHOTO_ALLOWANCE} photo descriptions and{" "}
                {TRIAL_AI_ASSISTANT_ALLOWANCE} Assistant questions a month.
              </p>
            )}
            {plan === "free" && trialLeft === 0 && (
              <p>You&rsquo;re on Free. Upgrade any time for unlimited galleries, more storage, and AI.</p>
            )}
            {complimentary && <p>Your {PLAN_LABELS[plan]} plan is complimentary, with nothing to pay.</p>}
            {subscribed && studio.periodEnd && (
              <p>
                {PLAN_LABELS[studio.subscribedPlan]}, billed {studio.planInterval === "year" ? "yearly" : "monthly"}.{" "}
                {studio.cancelling ? (
                  <strong>Ends on {date(studio.periodEnd)}, then moves to Free.</strong>
                ) : (
                  <>Renews on {date(studio.periodEnd)}.</>
                )}
              </p>
            )}
            {change && !studio.cancelling && (
              <p className="rounded-xl bg-sky-light/50 px-3 py-2">
                Changing to <strong>{PLAN_LABELS[change.plan]}</strong>, billed {change.interval === "year" ? "yearly" : "monthly"}, on{" "}
                {date(change.on)}. You keep everything you have now until then.
              </p>
            )}
            {studio.status === "past_due" && (
              <p className="font-semibold text-danger">
                Your last payment didn&rsquo;t go through. Update your card in Manage billing to keep your plan.
              </p>
            )}
          </div>
          {subscribed && (
            <form action={manageBilling} className="mt-6">
              <button type="submit" className="btn-secondary">
                Manage billing
              </button>
              <p className="mt-2 text-xs text-muted">Change plans, update your card, see invoices, or cancel.</p>
            </form>
          )}
        </section>

        <section className="card p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold">What you&rsquo;re using</h2>
          <div className="mt-5 space-y-5">
            <Meter
              label="Photo storage"
              used={usage.storageBytes}
              limit={usage.limits.storageBytes}
              show={formatStorage}
            />
            <Meter label="Active galleries" used={usage.activeGalleries} limit={usage.limits.activeGalleries} />
            <Meter label="AI gallery search this month (photos)" used={photosAi.used} limit={photosAi.limit} />
            <Meter label="Studio Assistant this month (questions)" used={assistant.used} limit={assistant.limit} />
          </div>
          <p className="mt-5 text-xs text-muted">
            Limits only stop new galleries and uploads. Nothing you already have is ever removed.
          </p>
        </section>
      </div>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold">Plans</h2>
            <p className="mt-1 text-sm text-muted">No fees on your clients&rsquo; payments on any plan.</p>
          </div>
          <IntervalSwitch interval={interval} href={(i) => `/dashboard/billing?interval=${i}`} />
        </div>
        <div className="mt-6">
          <PlanCards
            interval={interval}
            current={trialLeft > 0 ? undefined : plan}
            action={(p) => {
              if (complimentary || (p === plan && trialLeft === 0) || (p === "free" && !subscribed)) {
                return (
                  <button type="button" disabled className="btn-secondary w-full opacity-60">
                    {p === plan && trialLeft === 0 ? "Current plan" : "Included"}
                  </button>
                );
              }
              if (p === "free") {
                return (
                  <form action={manageBilling}>
                    <button type="submit" className="btn-secondary w-full">
                      Switch to Free
                    </button>
                  </form>
                );
              }
              return (
                <form action={subscribe}>
                  <input type="hidden" name="plan" value={p} />
                  <input type="hidden" name="interval" value={interval} />
                  <button
                    type="submit"
                    className={`w-full ${p === "pro" ? "btn-primary bg-lime text-brand-deep" : "btn-primary"}`}
                  >
                    {subscribed ? `Switch to ${PLAN_LABELS[p]}` : `Choose ${PLAN_LABELS[p]}`}
                  </button>
                </form>
              );
            }}
          />
        </div>
      </section>

      <section id="refer" className="card mt-12 scroll-mt-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">Refer a photographer</h2>
          <span className="rounded-full bg-lime/25 px-3 py-1 text-xs font-bold tracking-wider text-lime-ink uppercase">
            Earn free months
          </span>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Share your link with other photographers. They get a free {TRIAL_DAYS}-day Pro trial and{" "}
          {REFERRAL_DISCOUNT_PERCENT}% off their first plan payment. When that payment goes through, you get a month of
          your plan free ({`$${referralRewardCents(plan) / 100}`} credit on your next bill), up to {REFERRAL_YEARLY_CAP}{" "}
          months a year.
        </p>
        <div className="mt-5">
          <CopyLink url={`${siteUrl}/r/${referrals.code}`} label="Your referral link" />
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            ["Signed up", String(referrals.signups)],
            ["Became paying", String(referrals.paid)],
            ["Credit earned", `$${(referrals.earnedCents / 100).toLocaleString("en-US")}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-background px-3 py-4">
              <dt className="text-xs font-bold tracking-wider text-muted uppercase">{label}</dt>
              <dd className="mt-1 font-display text-3xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        {referrals.thisYear >= REFERRAL_YEARLY_CAP && (
          <p className="mt-3 text-sm font-semibold text-lime-ink">
            You&rsquo;ve earned the most free months for this year. Thank you for spreading the word!
          </p>
        )}
      </section>

      <section className="card mt-12 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">Your brand only</h2>
        <p className="mt-1 text-sm text-muted">
          Studio pages, booking pages, and review forms end with a small &ldquo;Powered by PhotoEZ Cloud&rdquo;
          line.
          {!hasFeature(plan, "removeBranding") && " Removing it is on the Studio plan."}
        </p>
        <div className="mt-4">
          <BrandingToggle hidden={studio.hideBranding} allowed={hasFeature(plan, "removeBranding")} />
        </div>
      </section>
    </div>
  );
}

// A labeled bar: how much of a plan limit is used.
function Meter({
  label,
  used,
  limit,
  show = (v: number) => v.toLocaleString("en-US"),
}: {
  label: string;
  used: number;
  limit: number | null;
  show?: (value: number) => string;
}) {
  const share = limit ? Math.min(1, used / limit) : 0;
  const tone = share >= 0.9 ? "bg-coral" : share >= 0.7 ? "bg-sun" : "bg-lime";
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">
          {show(used)} {limit === null ? "(unlimited)" : limit === 0 ? "(not on Free)" : `of ${show(limit)}`}
        </span>
      </div>
      {limit !== null && limit > 0 && (
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-background">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(share * 100, used > 0 ? 2 : 0)}%` }} />
        </div>
      )}
    </div>
  );
}
