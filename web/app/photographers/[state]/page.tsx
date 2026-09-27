import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listedCities } from "@/lib/directory/search";
import { STATE_NAMES, citySlug } from "@/lib/geo/zips";
import { DirectoryFooter, DirectoryHeader } from "../directory-ui";

// A state's page (/photographers/wa): the cities with listed photographers.

export async function generateMetadata({ params }: PageProps<"/photographers/[state]">): Promise<Metadata> {
  const { state } = await params;
  const name = STATE_NAMES[state.toUpperCase()];
  if (!name) return {};
  return {
    title: `Photographers in ${name} | PhotoEZ Cloud`,
    description: `Find local photographers across ${name}. See their work, reviews, and prices, and book online.`,
  };
}

export default async function StatePage({ params }: PageProps<"/photographers/[state]">) {
  const { state } = await params;
  const code = state.toUpperCase();
  const name = STATE_NAMES[code];
  if (!name || state !== state.toLowerCase()) notFound();
  const cities = await listedCities(code);

  return (
    <div className="flex flex-1 flex-col">
      <DirectoryHeader
        eyebrow={name}
        title={`Photographers in ${name}`}
        intro={`Pick a city, or search by ZIP code to see every studio within driving distance.`}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12">
        <p className="text-sm">
          <Link href="/photographers" className="link">
            All states
          </Link>
        </p>
        {cities.length === 0 ? (
          <p className="mt-6 text-muted">No studios listed in {name} yet. Try searching by ZIP code above.</p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cities.map((c) => (
              <li key={c.city}>
                <Link
                  href={`/photographers/${state}/${citySlug(c.city!)}`}
                  className="card flex items-center justify-between p-5 hover:border-brand"
                >
                  <span className="font-display text-lg font-bold">{c.city}</span>
                  <span className="text-sm text-muted">
                    {c.n} {c.n === 1 ? "studio" : "studios"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <DirectoryFooter />
    </div>
  );
}
