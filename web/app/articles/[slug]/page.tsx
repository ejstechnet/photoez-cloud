import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { LegalFooter } from "@/components/legal-page";
import { ARTICLES, findArticle } from "@/lib/articles";
import { siteUrl } from "@/lib/site";
import { ArticlesHeader } from "../site-header";

export function generateStaticParams() {
  return ARTICLES.map(({ meta }) => ({ slug: meta.slug }));
}

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const article = findArticle((await params).slug);
  if (!article) return { title: "Article not found · PhotoEZ Cloud" };
  const { meta } = article;
  return {
    title: `${meta.title} · PhotoEZ Cloud`,
    description: meta.description,
    alternates: { canonical: `/articles/${meta.slug}` },
    openGraph: {
      type: "article",
      title: meta.title,
      description: meta.description,
      url: `/articles/${meta.slug}`,
      publishedTime: meta.published,
    },
  };
}

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

// One photoezcloud.com article.
export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const article = findArticle((await params).slug);
  if (!article) notFound();
  const { meta, Body } = article;

  return (
    <div className="flex flex-1 flex-col">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: meta.title,
          description: meta.description,
          datePublished: meta.published,
          dateModified: meta.updated ?? meta.published,
          author: { "@type": "Person", name: "Elle Jones" },
          publisher: { "@type": "Organization", name: "PhotoEZ Cloud", logo: { "@type": "ImageObject", url: `${siteUrl}/icon.svg` } },
          mainEntityOfPage: `${siteUrl}/articles/${meta.slug}`,
          image: `${siteUrl}/opengraph-image`,
        }}
      />
      <ArticlesHeader>
        <Link href="/articles" className="text-xs font-bold tracking-wider text-white/70 uppercase hover:text-lime">
          ← All articles
        </Link>
        <p className="mt-4 text-sm font-bold tracking-wider text-lime uppercase">{meta.category}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">{meta.title}</h1>
        <p className="mt-4 text-white/70">
          By Elle Jones · {longDate(meta.published)} · {meta.readMinutes} min read
        </p>
      </ArticlesHeader>
      <main className="legal mx-auto w-full max-w-3xl flex-1 px-4 py-12 leading-relaxed">
        <Body />
      </main>
      <LegalFooter />
    </div>
  );
}
