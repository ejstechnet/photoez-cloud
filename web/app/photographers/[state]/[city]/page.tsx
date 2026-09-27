import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_RADIUS, searchDirectory } from "@/lib/directory/search";
import { STATE_NAMES, cityFromSlug } from "@/lib/geo/zips";
import { SESSION_LABELS } from "@/lib/session-types";
import { DirectoryFooter, DirectoryHeader, Results, parseRadius, parseType } from "../../directory-ui";

// A city's page (/photographers/wa/seattle): photographers within 25 miles
// of the city, for people who search Google for "photographers in Seattle".

export async function generateMetadata({ params }: PageProps<"/photographers/[state]/[city]">): Promise<Metadata> {
  const { state, city } = await params;
  const place = cityFromSlug(state, city);
  if (!place) return {};
  return {
    title: `Photographers in ${place.city}, ${place.state} | PhotoEZ Cloud`,
    description: `Local photographers in and around ${place.city}, ${STATE_NAMES[place.state]}: see their work, reviews, and prices, and book online.`,
    alternates: { canonical: `/photographers/${state}/${city}` },
  };
}

export default async function CityPage({ params, searchParams }: PageProps<"/photographers/[state]/[city]">) {
  const { state, city } = await params;
  const query = await searchParams;
  const place = cityFromSlug(state, city);
  if (!place) notFound();
  const radius = query.r ? parseRadius(query.r) : DEFAULT_RADIUS;
  const type = parseType(query.type);
  const listings = await searchDirectory({ center: place, radiusMiles: radius, type });
  const where = `${place.city}, ${place.state}`;

  return (
    <div className="flex flex-1 flex-col">
      <DirectoryHeader
        eyebrow={STATE_NAMES[place.state]}
        title={type ? `${SESSION_LABELS[type]} photographers in ${where}` : `Photographers in ${where}`}
        intro={`Studios in and around ${place.city}. See their work, reviews, and prices, then book or send a message.`}
        query={where}
        radius={radius}
        type={type}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12">
        <p className="mb-6 text-sm">
          <Link href="/photographers" className="link">
            All states
          </Link>{" "}
          ·{" "}
          <Link href={`/photographers/${state}`} className="link">
            {STATE_NAMES[place.state]}
          </Link>
        </p>
        <Results listings={listings} where={where} radius={radius} />
      </main>
      <DirectoryFooter />
    </div>
  );
}
