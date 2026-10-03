import type { MetadataRoute } from "next";
import { listedCities, listedStudioSlugs } from "@/lib/directory/search";
import { citySlug } from "@/lib/geo/zips";
import { siteUrl } from "@/lib/site";
import { ARTICLES } from "@/lib/articles";

// For search engines: the public pages, including every directory state and
// city with listed photographers, and the listed studios' pages. Built on
// each request so new listings show up right away.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cities, slugs] = await Promise.all([listedCities(), listedStudioSlugs()]);
  const states = [...new Set(cities.map((c) => c.state!.toLowerCase()))];
  return [
    { url: `${siteUrl}/`, priority: 1 },
    { url: `${siteUrl}/pricing`, priority: 0.8 },
    { url: `${siteUrl}/articles`, priority: 0.7 },
    ...ARTICLES.map(({ meta }) => ({ url: `${siteUrl}/articles/${meta.slug}`, lastModified: meta.updated ?? meta.published, priority: 0.7 })),
    { url: `${siteUrl}/quiz`, priority: 0.5 },
    { url: `${siteUrl}/signup`, priority: 0.5 },
    { url: `${siteUrl}/terms`, priority: 0.2 },
    { url: `${siteUrl}/privacy`, priority: 0.2 },
    { url: `${siteUrl}/photographers`, priority: 0.9 },
    ...states.map((state) => ({ url: `${siteUrl}/photographers/${state}`, priority: 0.7 })),
    ...cities.map((c) => ({
      url: `${siteUrl}/photographers/${c.state!.toLowerCase()}/${citySlug(c.city!)}`,
      priority: 0.8,
    })),
    ...slugs.map((slug) => ({ url: `${siteUrl}/studio/${slug}`, priority: 0.6 })),
  ];
}
