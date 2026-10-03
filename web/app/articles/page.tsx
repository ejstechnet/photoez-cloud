import type { Metadata } from "next";
import Link from "next/link";
import { BlogCards } from "@/components/blog-cards";
import { LegalFooter } from "@/components/legal-page";
import { ARTICLES } from "@/lib/articles";
import { BLOG_URL, blogPosts } from "@/lib/blog";
import { ArticlesHeader } from "./site-header";

export const metadata: Metadata = {
  title: "Articles for Photographers: Software, Workflow & Comparisons · PhotoEZ Cloud",
  description:
    "Guides and honest comparisons for photographers: PhotoEZ Cloud, PhotoEZ for WordPress, booking, client galleries, and how they stack up against Pixieset, Pic-Time, and more.",
  alternates: { canonical: "/articles" },
};

// PhotoEZ Cloud's own articles, then the newest from the EJS Tech blog.
export default async function ArticlesPage() {
  const posts = await blogPosts();
  return (
    <div className="flex flex-1 flex-col">
      <ArticlesHeader>
        <p className="inline-flex rounded-full bg-lime px-3 py-1 text-xs font-bold tracking-wider text-brand-deep uppercase">Articles</p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">Straight talk about photography software</h1>
        <p className="mt-4 text-lg text-white/80">Guides, workflow tips, and honest comparisons from 17 years behind the camera.</p>
      </ArticlesHeader>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-14">
        <h2 className="font-display text-3xl font-bold">From PhotoEZ Cloud</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2">
          {ARTICLES.map(({ meta }) => (
            <li key={meta.slug}>
              <Link
                href={`/articles/${meta.slug}`}
                className="card group flex h-full flex-col p-6 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <p className="text-xs font-bold tracking-wider text-coral uppercase">
                  {meta.category} <span className="ml-2 font-semibold text-muted normal-case">{meta.readMinutes} min read</span>
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold group-hover:text-lime-ink">{meta.title}</h3>
                <p className="mt-2 flex-1 text-muted">{meta.description}</p>
                <p className="mt-4 text-sm font-bold text-lime-ink">Read the article →</p>
              </Link>
            </li>
          ))}
        </ul>

        {posts.length > 0 && (
          <>
            <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-bold">From the EJS Tech blog</h2>
                <p className="mt-1 text-muted">PhotoEZ for WordPress, comparisons, and the story behind PhotoEZ.</p>
              </div>
              <a href={BLOG_URL} target="_blank" rel="noopener" className="link text-sm">
                Visit the blog
              </a>
            </div>
            <div className="mt-6">
              <BlogCards posts={posts} />
            </div>
          </>
        )}
      </main>
      <LegalFooter />
    </div>
  );
}
