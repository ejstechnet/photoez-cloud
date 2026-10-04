import type { ComponentType } from "react";
import { IntroducingPhotoezCloud, introducingPhotoezCloud } from "./introducing-photoez-cloud";

// Articles published on photoezcloud.com itself (at /articles/<slug>). Each
// is a React component with its details; newest first. Articles on the EJS
// Tech blog (ejstech.net) are read from its feed instead (lib/blog.ts).

export type ArticleMeta = {
  slug: string;
  title: string;
  description: string;
  // ISO dates, e.g. "2026-10-03".
  published: string;
  updated?: string;
  category: string;
  readMinutes: number;
  // The article's picture (in public/), shown at its top and on its card, and
  // a 1200x630 copy for link previews.
  image?: { src: string; width: number; height: number; alt: string; share: string };
};

export const ARTICLES: { meta: ArticleMeta; Body: ComponentType }[] = [{ meta: introducingPhotoezCloud, Body: IntroducingPhotoezCloud }];

export function findArticle(slug: string) {
  return ARTICLES.find((a) => a.meta.slug === slug) ?? null;
}
