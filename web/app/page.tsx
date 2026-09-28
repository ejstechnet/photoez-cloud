import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { NavMenu } from "@/app/dashboard/nav-menu";
import { SignOutButton } from "@/app/dashboard/sign-out-button";
import Link from "next/link";
import Image from "next/image";
import { Logo, WorkflowPills } from "@/components/brand";
import {
  ArrowRightIcon,
  BagIcon,
  GiftIcon,
  MapPinIcon,
  CalendarIcon,
  CameraIcon,
  ChatIcon,
  ContractIcon,
  ImagesIcon,
  InboxIcon,
  SearchIcon,
  StarIcon,
  WandIcon,
} from "@/components/icons";
import { PHOTOEZ_LINKS, WORDPRESS_PLUGINS } from "@/lib/photoez-links";
import { WordPressMockup } from "@/components/marketing-mockups";

const features = [
  {
    title: "Inquiry triage",
    body: "New inquiries arrive sorted: session type, date, budget, and a reply drafted in your voice.",
    icon: <InboxIcon size={22} />,
    tile: "bg-coral",
  },
  {
    title: "Gallery search",
    body: "Type “first dance” or “shots with grandma” and find them in seconds.",
    icon: <SearchIcon size={22} />,
    tile: "bg-violet",
  },
  {
    title: "Culling help",
    body: "Blurry frames, closed eyes, and near-duplicates flagged before you deliver.",
    icon: <WandIcon size={22} />,
    tile: "bg-sun",
  },
  {
    title: "Studio assistant",
    body: "“Remind everyone whose gallery expires this week.” Done, after you approve it.",
    icon: <ChatIcon size={22} />,
    tile: "bg-lime",
  },
];

// What PhotoEZ Cloud does today (the home page's "in one place" list).
const cloudFeatures = [
  { title: "Your studio page", body: "Your work, sessions, reviews, and FAQ, with an inquiry form that sorts itself." },
  { title: "Step-by-step booking", body: "Real open times, deposits, and reschedules, and a gallery made the moment they book." },
  { title: "Proofing & delivery", body: "Watermarked proofs, client favorites and notes, paid extras, clean downloads." },
  { title: "Contracts", body: "Signed online, filled in from each booking automatically." },
  { title: "Payments", body: "Deposits, balances, and extras straight to your own Stripe account." },
  { title: "Gift cards & coupons", body: "Sell gift cards on your page; offer codes with limits you set." },
  { title: "Reviews", body: "Asked for after delivery, approved by you, shown on your page." },
  { title: "Emails & reminders", body: "Confirmations, reminders, and gallery emails sent for you." },
  { title: "Page Designer", body: "Your colors, fonts, banner, and gallery style." },
  { title: "Online store", body: "Clients order prints and products of their photos right from their gallery." },
  { title: "Photographer directory", body: "People searching nearby find your studio page. Free on every plan." },
  { title: "Referrals", body: "Clients share a link; their friends save, and they earn session credit." },
];

// Elle's print and merch company, the store's first print partner.
const SWAGGPRESS_URL = "https://swaggpress.com";

// "Grow your business": the features that bring in money and new clients.
const growth = [
  {
    title: "Sell prints and products",
    body: "Your clients order prints, canvases, and more of their own photos from their gallery, framed exactly how they like. You set the prices, and the money goes straight to your Stripe.",
    icon: <BagIcon size={24} />,
    tile: "bg-coral",
    link: { href: "/pricing", label: "Included on every plan" },
  },
  {
    title: "Get found nearby",
    body: "The PhotoEZ Cloud directory lists your studio for people searching their ZIP code or city, ranked by distance and reviews. Their messages land in your inquiries.",
    icon: <MapPinIcon size={24} />,
    tile: "bg-sky",
    link: { href: "/photographers", label: "See the directory" },
  },
  {
    title: "Turn clients into referrals",
    body: "Every client gets a share link. Friends save on their first session, and your client earns credit toward their next one once that session happens.",
    icon: <GiftIcon size={24} />,
    tile: "bg-lime",
    link: null,
  },
];

// An icon and color for each plugin in "Meet PhotoEZ for WordPress".
const PLUGIN_ICONS: Record<(typeof WORDPRESS_PLUGINS)[number]["name"], { icon: React.ReactNode; tint: string }> = {
  PhotoEZ: { icon: <ImagesIcon size={20} />, tint: "bg-violet/15 text-violet" },
  "PhotoEZ Booking": { icon: <CalendarIcon size={20} />, tint: "bg-sky/20 text-brand" },
  "PhotoEZ Photography Contracts": { icon: <ContractIcon size={20} />, tint: "bg-coral/15 text-coral" },
  "PhotoEZ Event Gallery": { icon: <CameraIcon size={20} />, tint: "bg-sun/25 text-brand-deep" },
  "PhotoEZ Reviews": { icon: <StarIcon size={20} />, tint: "bg-lime/20 text-lime-ink" },
};

export default async function Home() {
  // Logged-in photographers get their own menu and buttons here.
  const session = await auth.api.getSession({ headers: await headers() });
  const studioSlug = session
    ? ((
        await db.select({ slug: photographers.studioSlug }).from(photographers).where(eq(photographers.id, session.user.id))
      )[0]?.slug ?? null)
    : null;

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden bg-brand-deep text-white">
        {/* The photographer-at-work image, faded into the navy on every side so its
            soft white edges never show. Behind the text on wide screens. */}
        <Image
          src="/home/hero.webp"
          alt="A smiling photographer shooting with her camera, surrounded by PhotoEZ Cloud cards: a new inquiry sorted by AI, photos found, a gallery delivered, a client gallery, and a booking confirmed."
          width={2800}
          height={1867}
          priority
          // Starts right after the text column and fits the whole image (cards included) in what's left.
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[min(68%,calc(100%_-_440px))] object-contain object-right lg:block"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 13%), linear-gradient(to top, transparent 0%, black 12%), linear-gradient(to bottom, transparent 0%, black 8%), linear-gradient(to left, transparent 0%, black 6%)",
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-80 rounded-full bg-coral/20 blur-3xl" />

        <header className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
          <Logo />
          {session ? (
            <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2" aria-label="Your studio">
              <Link href="/" className="hidden rounded-full px-3 py-2 text-xs font-bold tracking-wider text-white/90 uppercase hover:text-lime sm:block">
                Home
              </Link>
              {studioSlug && (
                <Link
                  href={`/studio/${studioSlug}`}
                  className="hidden rounded-full px-3 py-2 text-xs font-bold tracking-wider text-white/90 uppercase hover:text-lime md:block"
                >
                  My studio page
                </Link>
              )}
              <NavMenu
                label="Dashboard"
                items={[
                  { href: "/dashboard", label: "Overview", exact: true },
                  { href: "/dashboard/bookings", label: "Bookings" },
                  { href: "/dashboard/galleries", label: "Galleries" },
                  { href: "/dashboard/clients", label: "Clients" },
                  { href: "/dashboard/assistant", label: "Studio Assistant" },
                  { href: "/dashboard/settings", label: "Settings" },
                  { href: "/dashboard/billing", label: "Billing" },
                  ...(studioSlug ? [{ href: `/studio/${studioSlug}`, label: "My studio page" }] : []),
                ]}
              />
              <SignOutButton />
            </nav>
          ) : (
            <nav className="flex items-center gap-6">
              <Link href="/" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
                Home
              </Link>
              <Link
                href="/photographers"
                className="hidden text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime sm:block"
              >
                Find a photographer
              </Link>
              <Link href="/pricing" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
                Pricing
              </Link>
              <Link href="/login" className="text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime">
                Log in
              </Link>
            </nav>
          )}
        </header>

        <div className="relative mx-auto max-w-7xl px-4 pt-10 pb-20 lg:pt-16 lg:pb-28">
          <div className="lg:max-w-xl">
            <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">
              PhotoEZ, now in the cloud
            </p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Studio software with a{" "}
              {/* Padding below the words leaves room for the underline. */}
              <span className="relative inline-block pb-4 italic text-lime">
                creative streak
                <svg
                  className="absolute bottom-0 left-0 h-3 w-full text-sun"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M2 9c40-6 80-8 120-5s60 3 76 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
              .
            </h1>
            <p className="mt-6 max-w-lg text-lg text-white/80">
              Booking, galleries, delivery, and a print store, with AI that reads your inquiries, finds your shots, and
              handles the busywork so you can get back behind the camera.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {session ? (
                <>
                  <Link href="/dashboard" className="btn-primary bg-lime text-brand-deep">
                    Go to your dashboard <ArrowRightIcon size={18} />
                  </Link>
                  {studioSlug && (
                    <Link
                      href={`/studio/${studioSlug}`}
                      className="btn-secondary border-white/30 bg-transparent text-white hover:border-lime"
                    >
                      View your studio page
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link href="/signup" className="btn-primary bg-lime text-brand-deep">
                    Start your studio <ArrowRightIcon size={18} />
                  </Link>
                  <Link href="/login" className="btn-secondary border-white/30 bg-transparent text-white hover:border-lime">
                    I have an account
                  </Link>
                </>
              )}
            </div>
          </div>
          {/* On phones and tablets, the image sits under the text instead. */}
          <Image
            src="/home/hero.webp"
            alt=""
            width={2800}
            height={1867}
            className="mx-auto mt-10 w-full max-w-2xl lg:hidden"
            style={{
              maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 70%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative border-t border-white/10 bg-brand-deep/40">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/70">Every client, from first hello to final delivery.</p>
            <WorkflowPills />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20">
        <p className="text-sm font-bold tracking-wider text-coral uppercase">The AI toolkit</p>
        <h2 className="mt-2 max-w-xl font-display text-4xl font-bold tracking-tight">
          Less admin. <span className="italic text-link">More art.</span>
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="card p-6 transition hover:-translate-y-1 hover:shadow-xl">
              <span className={`grid size-12 place-items-center rounded-2xl text-brand-deep ${feature.tile}`}>
                {feature.icon}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Growing the business: store, directory, referrals. */}
      <section className="bg-brand-deep text-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-20">
          <p className="text-sm font-bold tracking-wider text-lime uppercase">Grow your business</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl font-bold tracking-tight">
            More clients. <span className="italic text-sun">More sales.</span>
          </h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {growth.map((item) => (
              <article key={item.title} className="rounded-3xl bg-white/10 p-6 ring-1 ring-white/10 transition hover:-translate-y-1 hover:bg-white/15 sm:p-8">
                <span className={`grid size-12 place-items-center rounded-2xl text-brand-deep ${item.tile}`}>{item.icon}</span>
                <h3 className="mt-5 font-display text-2xl font-bold">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-white/75">{item.body}</p>
                {item.link && (
                  <Link href={item.link.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold tracking-wider text-lime uppercase hover:underline">
                    {item.link.label} <ArrowRightIcon size={16} />
                  </Link>
                )}
              </article>
            ))}
          </div>

          {/* The print and merch partner (Elle's own company). */}
          <div className="mt-6 flex flex-col gap-6 rounded-3xl bg-surface p-6 text-foreground sm:flex-row sm:items-center sm:p-8">
            <a href={SWAGGPRESS_URL} target="_blank" rel="noopener" className="shrink-0 transition hover:opacity-80">
              <Image
                src="/home/swaggpress-logo.webp"
                alt="SwaggPress Creations"
                width={720}
                height={239}
                style={{ width: 240, height: "auto" }}
              />
            </a>
            <div>
              <p className="text-sm font-bold tracking-wider text-coral uppercase">Print &amp; merch partner · Coming soon</p>
              <p className="mt-2 text-lg leading-relaxed text-foreground/80">
                <strong className="text-foreground">SwaggPress Creations</strong> prints your clients&rsquo; photos on
                wide-format printers and presses them onto tees, hoodies, hats, tumblers, and graduate swag, then ships
                straight to their door. You set the prices.
              </p>
              <a
                href={SWAGGPRESS_URL}
                target="_blank"
                rel="noopener"
                className="mt-3 inline-flex items-center gap-1.5 text-base font-bold tracking-wider text-link uppercase hover:underline"
              >
                Visit SwaggPress Creations <ArrowRightIcon size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* What PhotoEZ Cloud does today. */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold tracking-wider text-lime-ink uppercase">PhotoEZ Cloud</p>
              <h2 className="mt-2 max-w-2xl font-display text-4xl font-bold tracking-tight">
                Your whole studio, <span className="italic text-link">in one place.</span>
              </h2>
              <p className="mt-3 max-w-2xl text-muted">
                Nothing to install or host. Sign up and get your own studio page, booking, galleries, and payments, all
                designed to look like your brand.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={session ? "/dashboard" : "/signup"} className="btn-primary">
                  {session ? "Go to your dashboard" : "Start your studio"} <ArrowRightIcon size={18} />
                </Link>
                {!session && (
                  <Link href="/login" className="btn-secondary">
                    Log in
                  </Link>
                )}
              </div>
            </div>
            {/* A photography studio (Elle's image, 1536×1024). */}
            <Image
              src="/home/studio.webp"
              alt="A bright photography studio with a camera on the desk, a backdrop, and studio lights"
              width={1536}
              height={1024}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="w-full rounded-3xl shadow-2xl ring-1 ring-black/5"
            />
          </div>
          <ul className="mt-16 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {cloudFeatures.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-lime text-xs font-bold text-brand-deep">
                  ✓
                </span>
                <span>
                  <span className="block font-semibold">{feature.title}</span>
                  <span className="block text-sm text-muted">{feature.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-16 flex flex-col items-start justify-between gap-5 rounded-3xl bg-lime/15 p-6 ring-1 ring-lime/30 sm:flex-row sm:items-center sm:p-8">
            <div>
              <p className="font-display text-2xl font-bold">Start free. Try Pro for 14 days.</p>
              <p className="mt-1 text-muted">No card needed. Stay on Free as long as you like, or grow into Pro and Studio.</p>
            </div>
            <Link href="/pricing" className="btn-primary shrink-0">
              See pricing <ArrowRightIcon size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* The WordPress suite, for photographers who run their own WordPress site. */}
      <section className="mx-auto w-full max-w-7xl px-4 py-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-sm font-bold tracking-wider text-violet uppercase">Prefer WordPress?</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight">
              Meet <span className="italic text-link">PhotoEZ for WordPress.</span>
            </h2>
            <p className="mt-3 text-muted">
              Already have a WordPress website? The PhotoEZ plugin suite brings proofing, booking, contracts, and more
              right into it, on your own site and your own hosting. Same PhotoEZ workflow, from the same maker.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={PHOTOEZ_LINKS.site} className="btn-primary">
                Visit photoez.net <ArrowRightIcon size={18} />
              </a>
              <a href={PHOTOEZ_LINKS.demos} className="btn-secondary">
                Try the demos
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">
              Start free with{" "}
              <a href={PHOTOEZ_LINKS.liteWordPressOrg} className="link">
                PhotoEZ Lite on WordPress.org
              </a>
              , or{" "}
              <a href={PHOTOEZ_LINKS.buy} className="link">
                get the full suite
              </a>{" "}
              from EJS Tech.
            </p>
            <div className="mt-10">
              <WordPressMockup />
            </div>
          </div>
          <ul className="grid gap-3">
            {WORDPRESS_PLUGINS.map((plugin) => (
              <li key={plugin.name} className="card flex items-start gap-4 p-5">
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl ${PLUGIN_ICONS[plugin.name].tint}`}
                >
                  {PLUGIN_ICONS[plugin.name].icon}
                </span>
                <span>
                  <span className="block font-semibold">{plugin.name}</span>
                  <span className="block text-sm text-muted">{plugin.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mt-auto border-t border-border bg-surface py-10 text-sm text-muted">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo tone="dark" />
            <p className="mt-3">Built by Elle Jones · Part of the PhotoEZ family from EJS Tech</p>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-2" aria-label="More from PhotoEZ">
            <p className="font-bold tracking-wider text-foreground uppercase">PhotoEZ Cloud</p>
            <p className="font-bold tracking-wider text-foreground uppercase">PhotoEZ for WordPress</p>
            <Link href={session ? "/dashboard" : "/signup"} className="hover:text-foreground">
              {session ? "Your dashboard" : "Start your studio"}
            </Link>
            <a href={PHOTOEZ_LINKS.site} className="hover:text-foreground">
              photoez.net
            </a>
            {session && studioSlug ? (
              <Link href={`/studio/${studioSlug}`} className="hover:text-foreground">
                Your studio page
              </Link>
            ) : (
              <Link href="/login" className="hover:text-foreground">
                Log in
              </Link>
            )}
            <a href={PHOTOEZ_LINKS.demos} className="hover:text-foreground">
              Plugin demos
            </a>
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <span />
            <Link href="/photographers" className="hover:text-foreground">
              Find a photographer
            </Link>
            <a href={PHOTOEZ_LINKS.liteWordPressOrg} className="hover:text-foreground">
              PhotoEZ Lite on WordPress.org
            </a>
            <span />
            <a href={PHOTOEZ_LINKS.lite} className="hover:text-foreground">
              About PhotoEZ Lite
            </a>
            <span />
            <a href={PHOTOEZ_LINKS.ejstech} className="hover:text-foreground">
              EJS Tech
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
