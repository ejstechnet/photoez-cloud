import Link from "next/link";
import { Logo } from "@/components/brand";
import { formatPrice } from "@/lib/booking/format";
import { DEFAULT_RADIUS, RADIUS_CHOICES, type Listing } from "@/lib/directory/search";
import { OFFERABLE_TYPES, SESSION_LABELS, type SessionType } from "@/lib/session-types";

// Shared pieces of the photographer directory pages (/photographers).

// The navy header with the search form, like the home and pricing pages.
export function DirectoryHeader({
  eyebrow,
  title,
  intro,
  query = "",
  radius = DEFAULT_RADIUS,
  type = null,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  query?: string;
  radius?: number;
  type?: SessionType | null;
}) {
  const select =
    "h-12 rounded-full border-0 bg-white px-4 text-sm font-semibold text-foreground focus:ring-4 focus:ring-lime/60 focus:outline-none";
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-6">
          <Link href="/" className="hidden text-sm font-bold tracking-wider text-white/90 uppercase hover:text-lime sm:block">
            Home
          </Link>
          <Link href="/photographers" className="text-xs font-bold tracking-wider whitespace-nowrap text-lime uppercase sm:text-sm">
            Find a photographer
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-14">
        <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-6xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-white/80">{intro}</p>
        {/* A plain GET form: searches work without JavaScript and can be shared as links. */}
        <form action="/photographers" className="mt-8 flex flex-col gap-3 lg:flex-row" role="search">
          <label className="flex-1">
            <span className="sr-only">ZIP code or city</span>
            <input
              name="q"
              defaultValue={query}
              required
              placeholder="ZIP code or city, like 98101 or Seattle, WA"
              className="h-12 w-full rounded-full border-0 bg-white px-5 text-foreground placeholder:text-muted focus:ring-4 focus:ring-lime/60 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <label>
              <span className="sr-only">Distance</span>
              <select name="r" defaultValue={radius} className={select}>
                {RADIUS_CHOICES.map((miles) => (
                  <option key={miles} value={miles}>
                    Within {miles} miles
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Type of photography</span>
              <select name="type" defaultValue={type ?? ""} className={select}>
                <option value="">Any kind of photography</option>
                {OFFERABLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SESSION_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary h-12 bg-lime text-brand-deep">
              Search
            </button>
          </div>
        </form>
      </div>
    </header>
  );
}

function Stars({ rating }: { rating: number }) {
  const whole = Math.round(rating);
  return (
    <span className="tracking-wider text-sun" aria-hidden="true">
      {"★".repeat(whole)}
      <span className="text-border">{"★".repeat(5 - whole)}</span>
    </span>
  );
}

// One photographer in the results.
export function ListingCard({ listing }: { listing: Listing }) {
  const studioHref = `/studio/${listing.slug}?from=directory`;
  const types = (listing.offeredTypes as SessionType[]).filter((t) => t in SESSION_LABELS);
  return (
    <article className="card flex flex-col gap-5 p-5 sm:p-6 md:flex-row">
      <div className="flex min-w-0 flex-1 gap-4">
        {listing.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt=""
            className={`size-20 shrink-0 rounded-full border border-border ${listing.headshotKey ? "object-cover" : "bg-white object-contain p-2"}`}
          />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-sky-light font-display text-3xl font-bold text-brand">
            {listing.studioName.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold">
            <Link href={studioHref} className="hover:text-link">
              {listing.studioName}
            </Link>
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {listing.city}, {listing.state} · {listing.miles < 1 ? "under 1 mile" : `${Math.round(listing.miles)} miles away`}
          </p>
          {listing.rating !== null ? (
            <p className="mt-1 text-sm">
              <Stars rating={listing.rating} /> <strong>{listing.rating.toFixed(1)}</strong>{" "}
              <span className="text-muted">
                ({listing.reviewCount} {listing.reviewCount === 1 ? "review" : "reviews"})
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">New to PhotoEZ Cloud</p>
          )}
          {listing.tagline && <p className="mt-2 text-sm">{listing.tagline}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {types.slice(0, 5).map((t) => (
              <span key={t} className="rounded-full bg-violet/10 px-2.5 py-0.5 text-xs font-semibold text-violet">
                {SESSION_LABELS[t]}
              </span>
            ))}
            {types.length > 5 && <span className="px-1 text-xs text-muted">+{types.length - 5} more</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 md:w-96 md:shrink-0">
        {listing.photoUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {listing.photoUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${listing.studioName} photography example ${i + 1}`}
                loading="lazy"
                className="aspect-[2/3] w-full rounded-xl object-cover"
              />
            ))}
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-end gap-3">
          {listing.startingCents !== null && (
            <p className="mr-auto text-sm whitespace-nowrap">
              <span className="text-muted">Sessions from</span>{" "}
              <strong className="font-display text-lg">{formatPrice(listing.startingCents)}</strong>
            </p>
          )}
          <Link href={`${studioHref}#contact`} className="btn-secondary px-4 py-2 text-xs">
            Contact
          </Link>
          <Link href={studioHref} className="btn-primary px-4 py-2 text-xs">
            View studio
          </Link>
        </div>
      </div>
    </article>
  );
}

export function Results({ listings, where, radius }: { listings: Listing[]; where: string; radius: number }) {
  if (listings.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-2xl font-bold">No photographers within {radius} miles of {where} yet.</p>
        <p className="mt-2 text-muted">
          Try a larger distance or any kind of photography. The directory is new, and more studios join every week.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-muted">
        {listings.length} {listings.length === 1 ? "photographer" : "photographers"} within {radius} miles of {where}
      </p>
      <div className="mt-4 space-y-5">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}

// For photographers who land here, plus the ZIP data credit.
export function DirectoryFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <strong className="text-foreground">Are you a photographer?</strong> List your studio free on any plan.{" "}
          <Link href="/signup" className="link">
            Start your studio
          </Link>
        </p>
        <p className="text-xs">
          ZIP code data ©{" "}
          <a href="https://www.geonames.org/" className="underline">
            GeoNames
          </a>{" "}
          (CC BY 4.0)
        </p>
      </div>
    </footer>
  );
}

export const parseRadius = (value: unknown) => {
  const miles = Number(value);
  return (RADIUS_CHOICES as readonly number[]).includes(miles) ? miles : DEFAULT_RADIUS;
};

export const parseType = (value: unknown): SessionType | null =>
  (OFFERABLE_TYPES as readonly string[]).includes(String(value)) ? (value as SessionType) : null;
