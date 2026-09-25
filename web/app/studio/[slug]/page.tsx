import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingHours, photographers, sessionTypes, studioFaqs } from "@/db/schema";
import { PhotoEZCloudMark } from "@/components/brand";
import { formatDuration, formatPrice } from "@/lib/booking/format";
import { currentPrice } from "@/lib/booking/pricing";
import { localDateOf } from "@/lib/booking/time";
import { LOCATION_LABELS, OFFERABLE_TYPES, SESSION_LABELS, type ShootLocation } from "@/lib/session-types";
import { richTextHtml } from "@/lib/rich-text";
import { signedViewUrl } from "@/lib/storage";
import { InquiryForm } from "./inquiry-form";
import { NavBrand } from "./nav-brand";

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
      tagline: photographers.studioTagline,
      bio: photographers.studioBio,
      serviceArea: photographers.serviceArea,
      offeredTypes: photographers.offeredTypes,
      shootLocations: photographers.shootLocations,
      quoteOnlyTypes: photographers.quoteOnlyTypes,
      timeZone: photographers.timeZone,
    })
    .from(photographers)
    .where(eq(photographers.studioSlug, slug.toLowerCase()));
  return studio ?? null;
}

export async function generateMetadata({ params }: PageProps<"/studio/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const studio = await findStudio(slug);
  if (!studio) return { title: "Studio not found · PhotoEZ Cloud" };
  const name = studio.businessName ?? studio.name;
  return { title: `${name} · Photography`, description: studio.tagline ?? `Book a session with ${name}.` };
}

export default async function StudioPage({ params }: PageProps<"/studio/[slug]">) {
  const { slug } = await params;
  const studio = await findStudio(slug);
  if (!studio) notFound();

  const name = studio.businessName ?? studio.name;
  const logoUrl = studio.logoKey ? await signedViewUrl(studio.logoKey) : null;
  // Keep the photographer's offered sessions in a consistent order.
  const sessions = OFFERABLE_TYPES.filter((type) => studio.offeredTypes.includes(type)).map((type) => ({
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
      .where(and(eq(sessionTypes.photographerId, studio.id), eq(sessionTypes.hidden, false)))
      .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt)),
    db.select({ id: bookingHours.id }).from(bookingHours).where(eq(bookingHours.photographerId, studio.id)).limit(1),
    db
      .select({ id: studioFaqs.id, question: studioFaqs.question, answer: studioFaqs.answer })
      .from(studioFaqs)
      .where(eq(studioFaqs.photographerId, studio.id))
      .orderBy(asc(studioFaqs.sortOrder)),
  ]);
  const bookingOpen = bookable.length > 0 && Boolean(hours);
  // Special prices apply by the studio's own calendar day.
  const today = localDateOf(new Date(), studio.timeZone);
  const bookHref = `/studio/${slug.toLowerCase()}/book`;

  // The owner viewing their own page gets a shortcut to edit it.
  const session = await auth.api.getSession({ headers: await headers() });
  const isOwner = session?.user.id === studio.id;

  const links = [
    bookingOpen && { href: "#book", label: "Book" },
    studio.bio && { href: "#about", label: "About" },
    sessions.length > 0 && { href: "#sessions", label: "Sessions" },
    studio.shootLocations.length > 0 && { href: "#where", label: "Where we shoot" },
    faqs.length > 0 && { href: "#faq", label: "FAQ" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <div className="flex flex-1 flex-col">
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-brand-deep/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <NavBrand>
            {logoUrl && (
              <span
                className="grid size-9 shrink-0 place-items-center rounded-lg p-1"
                style={{ backgroundColor: studio.logoBg }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
              </span>
            )}
            <span className="truncate font-display text-lg">{name}</span>
          </NavBrand>
          <div className="ml-auto flex items-center gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hidden rounded-full px-3 py-1.5 text-xs font-bold tracking-wider text-white/75 uppercase transition hover:bg-white/10 hover:text-white md:block"
              >
                {link.label}
              </a>
            ))}
            {isOwner && (
              <Link
                href="/dashboard/settings#studio"
                className="rounded-full px-3 py-1.5 text-xs font-bold tracking-wider text-sun uppercase hover:bg-white/10"
              >
                Edit page
              </Link>
            )}
            {bookingOpen ? (
              <Link
                href={bookHref}
                className="ml-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider whitespace-nowrap text-brand-deep uppercase transition hover:-translate-y-0.5"
              >
                Book now
              </Link>
            ) : (
              <a
                href="#contact"
                className="ml-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider whitespace-nowrap text-brand-deep uppercase transition hover:-translate-y-0.5"
              >
                Get in touch
              </a>
            )}
          </div>
        </div>
      </nav>

      <header id="top" className="relative overflow-hidden bg-brand text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-lime/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 size-72 rounded-full bg-coral/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-center">
          {logoUrl && (
            // A card in the photographer's chosen color, so their logo reads well
            // on navy ("transparent" puts it straight on the header).
            <div
              className={`grid size-32 shrink-0 place-items-center rounded-3xl p-3 sm:size-36 ${
                studio.logoBg === "transparent" ? "" : "shadow-2xl shadow-black/30"
              }`}
              style={{ backgroundColor: studio.logoBg }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={`${name} logo`} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          <div className="min-w-0">
            {studio.serviceArea && (
              <p className="text-sm font-bold tracking-wider text-sky-light uppercase">{studio.serviceArea}</p>
            )}
            <h1 className="mt-2 font-display text-5xl font-bold tracking-tight break-words sm:text-6xl">{name}</h1>
            {studio.tagline && <p className="mt-4 max-w-2xl text-xl text-white/80">{studio.tagline}</p>}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 py-12 lg:grid-cols-[1fr_1.15fr]">
        <section className="space-y-8">
          {bookingOpen && (
            <div id="book" className="scroll-mt-24">
              <h2 className="font-display text-2xl font-bold">Book a session</h2>
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
                          {s.shortDescription ?? formatDuration(s.durationMinutes)}
                        </p>
                      </div>
                      <span className="text-right">
                        <span className="block font-bold text-lime-ink">{formatPrice(currentPrice(s, today).priceCents)}</span>
                        {currentPrice(s, today).wasCents !== null && (
                          <s className="block text-xs text-muted">{formatPrice(currentPrice(s, today).wasCents!)}</s>
                        )}
                      </span>
                      <span className="rounded-full bg-lime px-3 py-1 text-[11px] font-bold tracking-wider text-brand-deep uppercase">
                        Book
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {studio.bio && (
            <div id="about" className="scroll-mt-24">
              <h2 className="font-display text-2xl font-bold">About</h2>
              <div
                className="rich-text mt-3 text-muted"
                // Cleaned by richTextHtml (lib/rich-text.ts) to simple formatting only.
                dangerouslySetInnerHTML={{ __html: richTextHtml(studio.bio) }}
              />
            </div>
          )}
          {sessions.length > 0 && (
            <div id="sessions" className="scroll-mt-24">
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
          {studio.shootLocations.length > 0 && (
            <div id="where" className="scroll-mt-24">
              <h2 className="font-display text-2xl font-bold">Where we shoot</h2>
              <p className="mt-3 text-muted">
                {studio.shootLocations.map((place) => LOCATION_LABELS[place as ShootLocation]).join(" · ")}
              </p>
            </div>
          )}
          {faqs.length > 0 && (
            <div id="faq" className="scroll-mt-24">
              <h2 className="font-display text-2xl font-bold">Questions &amp; answers</h2>
              <div className="mt-3 divide-y divide-border rounded-2xl border-2 border-border bg-surface">
                {faqs.map((faq) => (
                  <details key={faq.id} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                      {faq.question}
                      <span className="text-lime-ink transition group-open:rotate-45" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 whitespace-pre-line text-muted">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Navy panel so the contact form stands apart from the rest of the page. */}
        <section
          id="contact"
          className="relative scroll-mt-24 self-start overflow-hidden rounded-3xl bg-brand-deep p-6 text-white shadow-xl shadow-brand-deep/25 sm:p-8"
        >
          <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-lime/20 blur-3xl" />
          <h2 className="relative font-display text-3xl font-bold">Let&apos;s talk</h2>
          <p className="relative mt-1 text-white/75">Send a message and {name} will get back to you.</p>
          <div className="relative mt-6 rounded-2xl bg-surface p-5 text-foreground sm:p-6">
            <InquiryForm slug={slug.toLowerCase()} studioName={name} sessions={sessions} />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <p className="flex items-center justify-center gap-2 text-xs text-muted">
          <PhotoEZCloudMark className="h-5 w-7" /> Powered by PhotoEZ Cloud
        </p>
      </footer>
    </div>
  );
}
