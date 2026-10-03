import type { Metadata } from "next";
import Link from "next/link";
import { listedCities, searchDirectory } from "@/lib/directory/search";
import { STATE_NAMES, findPlace } from "@/lib/geo/zips";
import { SESSION_LABELS } from "@/lib/session-types";
import { DirectoryFooter, DirectoryHeader, Results, parseRadius, parseType } from "./directory-ui";

export const metadata: Metadata = {
  title: "Find a photographer near you | PhotoEZ Cloud",
  description:
    "Search local photographers by ZIP code or city: weddings, family, newborn, seniors, headshots, and more. See reviews and prices, and book online.",
  alternates: { canonical: "/photographers" },
};

// The directory's search page: /photographers?q=98101&r=25&type=wedding
export default async function DirectoryPage({ searchParams }: PageProps<"/photographers">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const radius = parseRadius(params.r);
  const type = parseType(params.type);
  const place = query ? findPlace(query) : null;
  const listings = place ? await searchDirectory({ center: place, radiusMiles: radius, type }) : [];
  const states = [...new Set((await listedCities()).map((c) => c.state!))].sort();
  const what = type ? `${SESSION_LABELS[type].toLowerCase()} photographers` : "photographers";

  return (
    <div className="flex flex-1 flex-col">
      <DirectoryHeader
        eyebrow="Photographer directory"
        title="Find a photographer near you"
        intro="Browse local studios, see their work, reviews, and prices, then book a session or send a message."
        query={query}
        radius={radius}
        type={type}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12">
        {query && !place && (
          <div className="card p-8 text-center">
            <p className="font-display text-2xl font-bold">We couldn&rsquo;t find &ldquo;{query}&rdquo;.</p>
            <p className="mt-2 text-muted">Try a 5-digit ZIP code, or a city and state like Seattle, WA.</p>
          </div>
        )}
        {place && (
          <>
            <h2 className="sr-only">
              {what} near {place.city}, {place.state}
            </h2>
            <Results listings={listings} where={`${place.city}, ${place.state}`} radius={radius} />
          </>
        )}
        {!query && (
          <section>
            <h2 className="font-display text-3xl font-bold">Browse by state</h2>
            {states.length === 0 ? (
              <p className="mt-3 text-muted">The directory is brand new. Search above to find studios near you.</p>
            ) : (
              <ul className="mt-5 flex flex-wrap gap-2">
                {states.map((state) => (
                  <li key={state}>
                    <Link
                      href={`/photographers/${state.toLowerCase()}`}
                      className="inline-flex rounded-full border-2 border-border bg-surface px-4 py-2 text-sm font-semibold hover:border-brand"
                    >
                      {STATE_NAMES[state] ?? state}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
      <DirectoryFooter />
    </div>
  );
}
