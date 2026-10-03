import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  bookingHours,
  photographers,
  sessionTypes,
  studioFaqs,
  studioPhotos,
} from "@/db/schema";
import { StudioFooter } from "./studio-bar";
import { GearIcon } from "@/components/icons";
import { formatDuration, formatPrice } from "@/lib/booking/format";
import { currentPrice } from "@/lib/booking/pricing";
import { localDateOf } from "@/lib/booking/time";
import {
  LOCATION_LABELS,
  OFFERABLE_TYPES,
  SESSION_LABELS,
  type ShootLocation,
} from "@/lib/session-types";
import { richTextHtml } from "@/lib/rich-text";
import { signedViewUrl } from "@/lib/storage";
import { InquiryForm } from "./inquiry-form";
import { PortfolioGallery } from "./portfolio-gallery";
import { FaqMore } from "./faq-more";
import { StudioNav, barIsDark } from "./studio-nav";
import { bannerBackground, textOn } from "@/lib/design";
import { designForSlug } from "@/lib/studio-design";
import {
  ReviewsJsonLd,
  StudioReviews,
  loadStudioReviews,
} from "./studio-reviews";

// A photographer's public studio page: who they are, what they shoot, and an
// inquiry form whose submissions land in their Inquiries, already triaged.

async function findStudio(slug: string) {
  const [studio] = await db
    .select({
      id: photographers.id,
      name: photographers.name,
      businessName: photographers.businessName,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
      headshotKey: photographers.headshotKey,
      tagline: photographers.studioTagline,
      bio: photographers.studioBio,
      serviceArea: photographers.serviceArea,
      offeredTypes: photographers.offeredTypes,
      shootLocations: photographers.shootLocations,
      quoteOnlyTypes: photographers.quoteOnlyTypes,
      timeZone: photographers.timeZone,
      giftCardsEnabled: photographers.giftCardsEnabled,
      stripeReady: photographers.stripeChargesEnabled,
    })
    .from(photographers)
    .where(eq(photographers.studioSlug, slug.toLowerCase()));
  return studio ?? null;
}

export async function generateMetadata({
  params,
}: PageProps<"/studio/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await findStudio(slug);
  if (!studio) return { title: "Studio not found · PhotoEZ Cloud" };
  const name = studio.businessName ?? studio.name;
  const area = studio.serviceArea?.trim().replace(/[.,;:!]+$/, "") ?? null;
  const description = studio.tagline ?? `See ${name}'s work, sessions, and reviews, and book a photography session online.`;
  return {
    // "… · Photography in Portland, OR" when the service area is short enough for a title.
    title: `${name} · Photography${area && area.length <= 40 ? ` in ${area}` : ""}`,
    description,
    alternates: { canonical: `/studio/${slug.toLowerCase()}` },
    openGraph: { title: `${name} · Photography`, description, url: `/studio/${slug.toLowerCase()}`, siteName: name },
  };
}

export default async function StudioPage({
  params,
  searchParams,
}: PageProps<"/studio/[slug]">) {
  const { slug } = await params;
  const { from } = await searchParams;
  const studio = await findStudio(slug);
  if (!studio) notFound();

  const name = studio.businessName ?? studio.name;
  const logoUrl = studio.logoKey ? await signedViewUrl(studio.logoKey) : null;
  const headshotUrl = studio.headshotKey
    ? await signedViewUrl(studio.headshotKey)
    : null;
  const design = await designForSlug(slug);
  const bannerPhotoUrl =
    design.banner === "photo" && design.bannerImageKey
      ? await signedViewUrl(design.bannerImageKey)
      : null;
  // White text on dark banners (and on photos, which get a dark shade).
  const bannerDark =
    Boolean(bannerPhotoUrl) || textOn(design.bannerColor) === "#ffffff";
  // Keep the photographer's offered sessions in a consistent order.
  const sessions = OFFERABLE_TYPES.filter((type) =>
    studio.offeredTypes.includes(type),
  ).map((type) => ({
    type,
    label: SESSION_LABELS[type],
    quote: studio.quoteOnlyTypes.includes(type),
  }));

  // Sessions clients can book online (booking needs weekly hours set too).
  const [bookable, [hours], faqs] = await Promise.all([
    db
      .select({
        id: sessionTypes.id,
        name: sessionTypes.name,
        shortDescription: sessionTypes.shortDescription,
        durationMinutes: sessionTypes.durationMinutes,
        priceCents: sessionTypes.priceCents,
        salePriceCents: sessionTypes.salePriceCents,
        saleEndsOn: sessionTypes.saleEndsOn,
      })
      .from(sessionTypes)
      .where(
        and(
          eq(sessionTypes.photographerId, studio.id),
          eq(sessionTypes.hidden, false),
        ),
      )
      .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt)),
    db
      .select({ id: bookingHours.id })
      .from(bookingHours)
      .where(eq(bookingHours.photographerId, studio.id))
      .limit(1),
    db
      .select({
        id: studioFaqs.id,
        question: studioFaqs.question,
        answer: studioFaqs.answer,
      })
      .from(studioFaqs)
      .where(eq(studioFaqs.photographerId, studio.id))
      .orderBy(asc(studioFaqs.sortOrder)),
  ]);
  const bookingOpen = bookable.length > 0 && Boolean(hours);
  const studioReviews = await loadStudioReviews(studio.id);
  const giftCardsOpen = studio.giftCardsEnabled && studio.stripeReady;
  const portfolio = await Promise.all(
    (
      await db
        .select({ id: studioPhotos.id, fileKey: studioPhotos.fileKey })
        .from(studioPhotos)
        .where(eq(studioPhotos.photographerId, studio.id))
        .orderBy(asc(studioPhotos.position), asc(studioPhotos.createdAt))
    ).map(async (photo) => ({
      id: photo.id,
      url: await signedViewUrl(photo.fileKey),
    })),
  );
  // Special prices apply by the studio's own calendar day.
  const today = localDateOf(new Date(), studio.timeZone);
  const bookHref = `/studio/${slug.toLowerCase()}/book`;

  // The owner viewing their own page gets a shortcut to edit it.
  const session = await auth.api.getSession({ headers: await headers() });
  const isOwner = session?.user.id === studio.id;

  const links = [
    (studio.bio || headshotUrl) && { href: "#about", label: "About" },
    bookingOpen && { href: "#book", label: "Book" },
    studioReviews.list.length > 0 && { href: "#reviews", label: "Reviews" },
    sessions.length > 0 && { href: "#sessions", label: "Sessions" },
    studio.shootLocations.length > 0 && {
      href: "#where",
      label: "Where we shoot",
    },
    faqs.length > 0 && { href: "#faq", label: "FAQ" },
    portfolio.length > 0 && { href: "#work", label: "Work" },
    giftCardsOpen && {
      href: `/studio/${slug.toLowerCase()}/gift-card`,
      label: "Gift cards",
    },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <div className="flex flex-1 flex-col">
      <ReviewsJsonLd
        name={name}
        slug={slug.toLowerCase()}
        reviews={studioReviews}
        description={studio.tagline}
        areaServed={studio.serviceArea}
      />
      <StudioNav
        slug={slug}
        name={name}
        logoUrl={logoUrl}
        logoBg={studio.logoBg}
        links={links}
        sticky
      >
        {isOwner && (
          <Link
            href="/dashboard/settings#studio"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold tracking-wider uppercase ${
              barIsDark(studio.logoBg)
                ? "text-sun hover:bg-white/10"
                : "text-brand hover:bg-brand-deep/5"
            }`}
          >
            <GearIcon size={17} strokeWidth={2.25} /> Settings
          </Link>
        )}
        {bookingOpen ? (
          <Link
            href={bookHref}
            className="ml-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider whitespace-nowrap text-on-accent uppercase transition hover:-translate-y-0.5"
          >
            Book now
          </Link>
        ) : (
          <a
            href="#contact"
            className="ml-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider whitespace-nowrap text-on-accent uppercase transition hover:-translate-y-0.5"
          >
            Get in touch
          </a>
        )}
      </StudioNav>

      {/* The banner, in the Page Designer's style: a color, a gradient, or a photo. */}
      <header
        id="top"
        className={`relative overflow-hidden ${bannerDark ? "text-white" : "text-[#111111]"}`}
        style={{ background: bannerBackground(design) }}
      >
        {bannerPhotoUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerPhotoUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
          </>
        )}
        <div
          className={`relative mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center ${
            bannerPhotoUrl ? "py-24 sm:py-32" : "py-14"
          }`}
        >
          <div className="min-w-0">
            {studio.serviceArea && (
              <p
                className={`text-sm font-bold tracking-wider uppercase ${bannerDark ? "text-white/75" : "text-black/60"}`}
              >
                {studio.serviceArea}
              </p>
            )}
            <h1 className="mt-2 font-display text-5xl font-bold tracking-tight break-words sm:text-6xl">
              {name}
            </h1>
            {studio.tagline && (
              <p
                className={`mt-4 max-w-2xl text-xl ${bannerDark ? "text-white/80" : "text-black/70"}`}
              >
                {studio.tagline}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 py-12 lg:grid-cols-[1fr_1.15fr]">
        {/* Each part in its own card, so sections read as separate blocks. */}
        <section className="space-y-6">
          {(studio.bio || headshotUrl) && (
            <div id="about" className="card scroll-mt-28 p-6">
              {headshotUrl ? (
                // The photographer's headshot beside "Meet …", so clients see who they'll work with.
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={headshotUrl}
                    alt={studio.name}
                    className="size-24 shrink-0 rounded-full object-cover shadow-lg ring-4 ring-lime/40 sm:size-28"
                  />
                  <div>
                    <h2 className="font-display text-2xl font-bold">About</h2>
                    <p className="mt-0.5 font-semibold text-muted">
                      Meet {studio.name}
                    </p>
                  </div>
                </div>
              ) : (
                <h2 className="font-display text-2xl font-bold">About</h2>
              )}
              {studio.bio && (
                <div
                  className="rich-text mt-3 text-muted"
                  // Cleaned by richTextHtml (lib/rich-text.ts) to simple formatting only.
                  dangerouslySetInnerHTML={{ __html: richTextHtml(studio.bio) }}
                />
              )}
            </div>
          )}
          {bookingOpen && (
            <div id="book" className="card scroll-mt-28 p-6">
              <h2 className="font-display text-2xl font-bold">
                Book a session
              </h2>
              <ul className="mt-3 grid gap-2">
                {bookable.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`${bookHref}?session=${s.id}`}
                      className="group flex items-center gap-4 rounded-2xl border-2 border-border bg-surface px-4 py-3 transition hover:-translate-y-0.5 hover:border-lime hover:shadow-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-sm text-muted">
                          {s.shortDescription ??
                            formatDuration(s.durationMinutes)}
                        </p>
                      </div>
                      <span className="text-right">
                        <span className="block font-bold text-lime-ink">
                          {formatPrice(currentPrice(s, today).priceCents)}
                        </span>
                        {currentPrice(s, today).wasCents !== null && (
                          <s className="block text-xs text-muted">
                            {formatPrice(currentPrice(s, today).wasCents!)}
                          </s>
                        )}
                      </span>
                      <span className="rounded-full bg-lime px-3 py-1 text-[11px] font-bold tracking-wider text-on-accent uppercase">
                        Book
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <StudioReviews reviews={studioReviews} />
          {giftCardsOpen && (
            <Link
              href={`/studio/${slug.toLowerCase()}/gift-card`}
              className="group card flex items-center gap-4 border-2 border-lime/50 bg-lime/10 p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="text-4xl" aria-hidden="true">
                🎁
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-bold">
                  Give the gift of photos
                </span>
                <span className="block text-sm text-muted">
                  Gift cards for any session, emailed on the day you choose.
                </span>
              </span>
              <span className="text-xs font-bold tracking-wider text-lime-ink uppercase transition group-hover:translate-x-1">
                Buy →
              </span>
            </Link>
          )}
          {studio.shootLocations.length > 0 && (
            <div id="where" className="card scroll-mt-28 p-6">
              <h2 className="font-display text-2xl font-bold">
                Where we shoot
              </h2>
              <p className="mt-3 text-muted">
                {studio.shootLocations
                  .map((place) => LOCATION_LABELS[place as ShootLocation])
                  .join(" · ")}
              </p>
            </div>
          )}
        </section>

        {/* Right column: the contact form, then the rest of the studio's details,
            so both columns carry a similar amount. */}
        <div className="space-y-6">
          {/* Navy panel so the contact form stands apart from the rest of the page. */}
          <section
            id="contact"
            className="relative scroll-mt-28 overflow-hidden rounded-3xl bg-brand-deep p-6 text-white shadow-xl shadow-brand-deep/25 sm:p-8"
          >
            <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-lime/20 blur-3xl" />
            <h2 className="relative font-display text-3xl font-bold">
              Let&apos;s talk
            </h2>
            <p className="relative mt-1 text-white/75">
              Send a message and {name} will get back to you.
            </p>
            <div className="relative mt-6 rounded-2xl bg-surface p-5 text-foreground sm:p-6">
              <InquiryForm
                slug={slug.toLowerCase()}
                studioName={name}
                sessions={sessions}
                fromDirectory={from === "directory"}
              />
            </div>
          </section>
          {sessions.length > 0 && (
            <div id="sessions" className="card scroll-mt-28 p-6">
              <h2 className="font-display text-2xl font-bold">Sessions</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {sessions.map((session) => (
                  <span
                    key={session.type}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                      session.quote ? "bg-sun/25" : "bg-lime/15 text-lime-ink"
                    }`}
                  >
                    {session.label}
                    {session.quote && " · by quote"}
                  </span>
                ))}
              </div>
            </div>
          )}
          {faqs.length > 0 && (
            <div id="faq" className="card scroll-mt-28 p-6">
              <h2 className="font-display text-2xl font-bold">
                Questions &amp; answers
              </h2>
              {/* The first few questions, then the rest behind "Show all", so a long FAQ stays tidy. */}
              <div className="mt-3 divide-y divide-border rounded-2xl border-2 border-border bg-surface">
                {faqs.slice(0, FAQ_SHOWN).map((faq) => (
                  <FaqItem
                    key={faq.id}
                    question={faq.question}
                    answer={faq.answer}
                  />
                ))}
              </div>
              {faqs.length > FAQ_SHOWN && (
                <FaqMore total={faqs.length}>
                  <div className="mt-3 divide-y divide-border rounded-2xl border-2 border-border bg-surface">
                    {faqs.slice(FAQ_SHOWN).map((faq) => (
                      <FaqItem
                        key={faq.id}
                        question={faq.question}
                        answer={faq.answer}
                      />
                    ))}
                  </div>
                </FaqMore>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Examples of work, full width under the booking and contact sections. */}
      <PortfolioGallery studioName={name} photos={portfolio} />

      <StudioFooter studioId={studio.id} />
    </div>
  );
}

// How many FAQ questions show before "Show all".
const FAQ_SHOWN = 5;

// One question; its answer opens on click.
function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
        {question}
        <span
          className="text-lime-ink transition group-open:rotate-45"
          aria-hidden="true"
        >
          +
        </span>
      </summary>
      <p className="mt-2 whitespace-pre-line text-muted">{answer}</p>
    </details>
  );
}
