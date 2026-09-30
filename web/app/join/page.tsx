import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { ArrowRightIcon } from "@/components/icons";
import { PLAN_LABELS, PLAN_PRICES, TRIAL_DAYS } from "@/lib/plans";
import { cleanSource } from "@/lib/leads";
import { joinAction } from "./actions";

export const metadata: Metadata = {
  title: "Try PhotoEZ Cloud free",
  description: `Booking, contracts, galleries, payments, and AI in one place for photographers. ${TRIAL_DAYS}-day Pro trial, no card needed, 0% commission.`,
};

const POINTS = [
  { title: `${TRIAL_DAYS} days of ${PLAN_LABELS.pro}, free`, body: "No card needed. When it ends you move to a Free plan that's still useful." },
  { title: "0% commission", body: "Clients pay you through your own Stripe account. PhotoEZ Cloud adds no fees." },
  { title: "Inquiry to delivery", body: "Booking, contracts, proofing, galleries, print sales, and AI that does the busywork." },
];

// A campaign landing page: one email box, then on to sign-up. Ads and posts
// link here as /join?src=<where>, which is saved with the address.
export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const { src, error } = await searchParams;
  const source = cleanSource(src);

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
          <Logo />
          <Link href="/login" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
            Log in
          </Link>
        </div>
        <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 text-center">
          <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">
            For photographers
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-6xl">Run your whole studio in one place.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Booking, contracts, client galleries, and payments, with AI that reads your inquiries and finds your shots.
          </p>

          <form action={joinAction} className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
            <input type="hidden" name="src" value={source ?? ""} />
            {/* Bots fill this in; people never see it. */}
            <div aria-hidden="true" className="absolute -left-[9999px]">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="flex-1">
              <span className="sr-only">Your email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@yourstudio.com"
                aria-invalid={error ? true : undefined}
                className="block w-full rounded-full border-2 border-white/20 bg-white px-5 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-lime focus:ring-4 focus:ring-lime/25 aria-invalid:border-danger"
              />
            </label>
            <button type="submit" className="btn-primary bg-lime text-brand-deep">
              Start free <ArrowRightIcon size={18} />
            </button>
          </form>
          {error ? (
            <p role="alert" className="mt-3 text-sm font-semibold text-sun">
              That doesn&rsquo;t look like an email address. Please check it and try again.
            </p>
          ) : (
            <p className="mt-3 text-xs text-white/60">
              We&rsquo;ll email you about PhotoEZ Cloud, and you can unsubscribe at any time.
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-14">
        <ul className="grid gap-6 sm:grid-cols-3">
          {POINTS.map((point) => (
            <li key={point.title} className="card p-6">
              <h2 className="font-display text-xl font-bold">{point.title}</h2>
              <p className="mt-2 text-sm text-muted">{point.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-muted">
          Free forever, or {PLAN_LABELS.pro} from ${PLAN_PRICES.pro.month / 100}/month.{" "}
          <Link href="/pricing" className="link">
            See all plans
          </Link>
        </p>
      </main>
    </div>
  );
}
