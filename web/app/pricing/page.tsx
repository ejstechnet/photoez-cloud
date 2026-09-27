import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { ArrowRightIcon } from "@/components/icons";
import { IntervalSwitch, PlanCards } from "@/components/plan-cards";
import { PLAN_LABELS, TRIAL_DAYS, type Interval } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: `PhotoEZ Cloud plans for photographers: Free, Pro, and Studio. Every new studio gets a ${TRIAL_DAYS}-day Pro trial, no card needed.`,
};

const QUESTIONS = [
  {
    q: "Do I need a card for the free trial?",
    a: `No. Every new studio gets Pro free for ${TRIAL_DAYS} days. When it ends you move to Free unless you choose a plan.`,
  },
  {
    q: "What happens if I go over a Free limit?",
    a: "Nothing is deleted. You just can't add new galleries or uploads past the limit until you mark finished galleries Completed or upgrade.",
  },
  {
    q: "Do you take a cut of my client payments?",
    a: "No. Clients pay you through your own Stripe account on every plan; PhotoEZ Cloud adds no fees.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Any time, from Billing in your dashboard. Upgrades start right away; cancelling keeps your plan until the end of the period you've paid for.",
  },
];

// The public plans page, linked from the home page.
export default async function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const { interval: asked } = await searchParams;
  const interval: Interval = asked === "year" ? "year" : "month";

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
          <Logo />
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
              Home
            </Link>
            <Link href="/login" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
              Log in
            </Link>
          </nav>
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 text-center">
          <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">
            Pricing
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-6xl">
            Start free. Grow into Pro.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Booking, galleries, contracts, and payments on every plan. Every new studio gets {TRIAL_DAYS} days of{" "}
            {PLAN_LABELS.pro} free, no card needed.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-12">
        <div className="flex justify-center">
          <IntervalSwitch interval={interval} href={(i) => (i === "year" ? "/pricing?interval=year" : "/pricing")} />
        </div>
        <div className="mt-8">
          <PlanCards
            interval={interval}
            action={(plan) => (
              <Link
                href="/signup"
                className={`w-full ${plan === "pro" ? "btn-primary bg-lime text-brand-deep" : plan === "studio" ? "btn-primary" : "btn-secondary"}`}
              >
                {plan === "free" ? "Start free" : `Try ${PLAN_LABELS.pro} free`} <ArrowRightIcon size={18} />
              </Link>
            )}
          />
        </div>

        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-center font-display text-3xl font-bold">Questions</h2>
          <dl className="mt-8 space-y-4">
            {QUESTIONS.map(({ q, a }) => (
              <div key={q} className="card p-6">
                <dt className="font-display text-lg font-bold">{q}</dt>
                <dd className="mt-2 text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
