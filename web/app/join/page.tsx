import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo, WorkflowPills } from "@/components/brand";
import {
  ArrowRightIcon,
  BagIcon,
  CalendarIcon,
  ChatIcon,
  ContractIcon,
  GiftIcon,
  ImagesIcon,
  InboxIcon,
  MapPinIcon,
  SearchIcon,
  StarIcon,
  WandIcon,
} from "@/components/icons";
import { PLAN_LABELS, PLAN_PRICES, TRIAL_DAYS } from "@/lib/plans";
import { cleanSource } from "@/lib/leads";
import { LegalFooter } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "One app for your whole photography business",
  description: `Booking, contracts, galleries, payments, a print store, and AI in one place. Try PhotoEZ Cloud Pro free for ${TRIAL_DAYS} days, no card needed, 0% commission.`,
  openGraph: {
    title: "One app for your whole photography business",
    description: `Retire the pile of apps. Booking to delivery in one place. ${TRIAL_DAYS}-day free trial, no card needed.`,
    images: ["/home/hero.webp"],
  },
  // The Facebook-ad landing page repeats the home page; keep it out of search
  // results so the two don't compete.
  robots: { index: false, follow: true },
};

// The apps photographers juggle now, and what PhotoEZ Cloud does instead.
const PILE = [
  { old: "Scheduling app", icon: <CalendarIcon size={22} />, tile: "bg-sky", now: "Step-by-step booking with real open times, deposits, and reschedules." },
  { old: "E-signature tool", icon: <ContractIcon size={22} />, tile: "bg-coral", now: "Contracts signed online, filled in from each booking for you." },
  { old: "Gallery host", icon: <ImagesIcon size={22} />, tile: "bg-violet", now: "Watermarked proofs, client favorites, paid extras, clean downloads." },
  { old: "Invoicing app", icon: <BagIcon size={22} />, tile: "bg-lime", now: "Deposits, balances, and extras paid straight to your own Stripe." },
  { old: "Print lab site", icon: <GiftIcon size={22} />, tile: "bg-sun", now: "Clients order prints, tees, mugs, and more right from their gallery." },
  { old: "Email reminders", icon: <InboxIcon size={22} />, tile: "bg-coral", now: "Confirmations, reminders, and gallery emails sent for you." },
  { old: "Website builder", icon: <MapPinIcon size={22} />, tile: "bg-sky", now: "Your own studio page, plus a directory where nearby clients find you." },
  { old: "Review requests", icon: <StarIcon size={22} />, tile: "bg-violet", now: "Reviews asked for after delivery, approved by you, shown on your page." },
];

const AI = [
  { title: "Inquiries sorted", body: "Session type, date, budget, and a reply drafted in your voice.", icon: <InboxIcon size={20} /> },
  { title: "Find any shot", body: "Type “first dance” or “shots with grandma” and there they are.", icon: <SearchIcon size={20} /> },
  { title: "Culling help", body: "Blurry frames, closed eyes, and near-duplicates flagged for you.", icon: <WandIcon size={20} /> },
  { title: "Studio assistant", body: "“Remind everyone whose gallery expires this week.” Done, once you approve.", icon: <ChatIcon size={20} /> },
];

const QUESTIONS = [
  {
    q: "Do I need a card for the free trial?",
    a: `No. You get everything in ${PLAN_LABELS.pro} free for ${TRIAL_DAYS} days. When it ends you move to the Free plan unless you choose one, and nothing is deleted.`,
  },
  {
    q: "Do you take a cut of my sales?",
    a: "No. Clients pay you through your own Stripe account on every plan. PhotoEZ Cloud adds 0% commission.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from Billing in your dashboard. Cancelling keeps your plan until the end of the period you've paid for.",
  },
];

const dollars = (cents: number) => `$${cents / 100}`;

// The Facebook campaign landing page: explains "one place instead of a pile of
// apps" and sends people straight to sign-up. Ads link here as
// /join?src=<where>; the source rides along to sign-up and is saved with the
// new account.
export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const { src } = await searchParams;
  const source = cleanSource(src);
  const signup = `/signup${source ? `?src=${encodeURIComponent(source)}` : ""}`;

  const cta = (label = "Start your free trial") => (
    <Link href={signup} className="btn-primary w-full justify-center bg-lime text-lg text-brand-deep sm:w-auto">
      {label} <ArrowRightIcon size={20} />
    </Link>
  );
  const assurance = (tone: string) => (
    <ul className={`mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-semibold lg:justify-start ${tone}`}>
      <li>✓ No card needed</li>
      <li>✓ 0% commission</li>
      <li>✓ {TRIAL_DAYS} days of Pro free</li>
    </ul>
  );

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero: deep navy, like the home page. */}
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: "#060f1e" }}>
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-violet/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-80 rounded-full bg-coral/20 blur-3xl" />
        <header className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
          <Logo />
          <Link href="/login" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
            Log in
          </Link>
        </header>

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pt-6 pb-16 lg:grid-cols-2 lg:pt-12 lg:pb-24">
          <div className="text-center lg:text-left">
            <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">
              For photographers
            </p>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              One app for your{" "}
              <span className="relative inline-block pb-3 italic text-lime">
                whole
                <svg className="absolute bottom-0 left-0 h-3 w-full text-sun" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 9c40-6 80-8 120-5s60 3 76 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>{" "}
              photography business.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/80 lg:mx-0">
              Stop juggling a booking app, a contract app, a gallery app, and a print lab. PhotoEZ Cloud runs it all, from the
              first inquiry to the final delivery, with AI that handles the busywork.
            </p>
            <div className="mt-8">{cta()}</div>
            {assurance("text-white/75")}
            <p className="mt-5 text-white/80">
              Not sure it fits?{" "}
              <Link href={`/quiz${source ? `?src=${encodeURIComponent(source)}` : ""}`} className="font-bold text-lime underline underline-offset-4 hover:text-sun">
                Take the 60-second quiz
              </Link>
            </p>
          </div>
          <Image
            src="/home/hero.webp"
            alt="A smiling photographer with PhotoEZ Cloud cards around her: a new inquiry sorted, photos found, a gallery delivered, and a booking confirmed."
            width={2800}
            height={1867}
            priority
            className="mx-auto w-full max-w-2xl"
            style={{ maskImage: "radial-gradient(ellipse 52% 52% at 50% 50%, black 72%, transparent 100%)" }}
          />
        </div>

        <div className="relative border-t border-white/10 bg-brand-deep/40">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-white/70">Every client, from first hello to final delivery.</p>
            <WorkflowPills />
          </div>
        </div>
      </section>

      {/* Retire the pile. */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        <p className="text-center text-sm font-bold tracking-wider text-coral uppercase">Retire the pile</p>
        <h2 className="mx-auto mt-2 max-w-3xl text-center font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Eight apps and their bills, <span className="italic text-link">replaced by one.</span>
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILE.map((item) => (
            <article key={item.old} className="card flex gap-4 p-4 transition hover:-translate-y-1 hover:shadow-xl sm:block sm:p-5">
              <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-brand-deep ${item.tile}`}>{item.icon}</span>
              <div>
                <p className="text-sm font-bold text-muted line-through decoration-coral decoration-2 sm:mt-3">{item.old}</p>
                <p className="mt-1 text-[15px] leading-snug sm:mt-2 sm:text-base sm:leading-relaxed">{item.now}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-10 text-center">{cta("Put it all in one place")}</div>
      </section>

      {/* The AI toolkit. */}
      <section className="text-white" style={{ backgroundColor: "#060f1e" }}>
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
          <p className="text-sm font-bold tracking-wider text-lime uppercase">The AI toolkit</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Less admin. <span className="italic text-sun">More art.</span>
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AI.map((item) => (
              <article key={item.title} className="rounded-3xl bg-white/10 p-6 ring-1 ring-white/10">
                <span className="grid size-11 place-items-center rounded-2xl bg-lime text-brand-deep">{item.icon}</span>
                <h3 className="mt-4 font-display text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-white/75">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Earn more from every gallery. */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
        <div className="flex flex-col items-center gap-8 rounded-3xl bg-surface p-6 sm:p-10 lg:flex-row">
          <div className="flex-1 text-center lg:text-left">
            <p className="text-sm font-bold tracking-wider text-coral uppercase">Earn more from every gallery</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">A print and merch store, built in.</h2>
            <p className="mt-4 text-lg leading-relaxed text-foreground/80">
              Clients order prints, canvases, tees, hoodies, mugs, and graduate swag of their own photos, and can design
              them right in their gallery. Our partner <strong>SwaggPress Creations</strong> makes them and ships to their
              door. You set the prices.
            </p>
          </div>
          <Image src="/home/swaggpress-logo.webp" alt="SwaggPress Creations" width={720} height={239} style={{ width: 260, height: "auto" }} />
        </div>
      </section>

      {/* Plans at a glance. */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:py-20">
          <p className="text-sm font-bold tracking-wider text-coral uppercase">Simple pricing</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-5xl">Start free. Grow when you&rsquo;re ready.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { name: PLAN_LABELS.free, price: "$0", note: "Free forever" },
              { name: PLAN_LABELS.pro, price: dollars(PLAN_PRICES.pro.month), note: `Free for ${TRIAL_DAYS} days`, star: true },
              { name: PLAN_LABELS.studio, price: dollars(PLAN_PRICES.studio.month), note: "For busy studios" },
            ].map((plan) => (
              <div key={plan.name} className={`card p-6 ${plan.star ? "ring-4 ring-lime" : ""}`}>
                <p className="font-display text-xl font-bold">{plan.name}</p>
                <p className="mt-2 font-display text-4xl font-bold">
                  {plan.price}
                  <span className="text-base font-semibold text-muted">/month</span>
                </p>
                <p className={`mt-2 text-sm font-semibold ${plan.star ? "text-lime-ink" : "text-muted"}`}>{plan.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-muted">
            Every plan: 0% commission, your own Stripe, and a listing in the photographer directory.{" "}
            <Link href="/pricing" className="link">
              Compare plans
            </Link>
          </p>
        </div>
      </section>

      {/* Questions. */}
      <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-20">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
        <div className="mt-8 space-y-3">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="card group p-5">
              <summary className="cursor-pointer list-none font-bold">
                <span className="mr-2 inline-block text-coral transition group-open:rotate-45">+</span>
                {item.q}
              </summary>
              <p className="mt-3 leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Last call. */}
      <section className="text-white" style={{ backgroundColor: "#060f1e" }}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Your whole studio, <span className="italic text-lime">one login.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">Set up takes minutes. Try everything free for {TRIAL_DAYS} days.</p>
          <div className="mt-8">{cta()}</div>
          <div className="flex justify-center">{assurance("text-white/75 lg:justify-center")}</div>
        </div>
      </section>
      <LegalFooter />
    </main>
  );
}
