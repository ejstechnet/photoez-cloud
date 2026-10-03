import { ogDescription, ogImage, parseFeed, type BlogPost } from "./blog-feed";

// The EJS Tech blog's articles (ejstech.net), shown on the home page and at
// /articles. Read from the WordPress feed at most once an hour and kept in
// memory; if the blog is slow or down, the last good copy (or nothing) is
// shown, and the page never waits more than a few seconds.

export const BLOG_URL = "https://ejstech.net/ejs-tech-blog/";
const FEED_URL = "https://ejstech.net/feed/";
const HOUR = 60 * 60 * 1000;

let cache: { at: number; posts: BlogPost[] } | null = null;

async function get(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": "PhotoEZ Cloud (+https://photoezcloud.com)" }, signal: AbortSignal.timeout(4000), cache: "no-store" });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

export async function blogPosts(): Promise<BlogPost[]> {
  if (cache && Date.now() - cache.at < HOUR) return cache.posts;
  try {
    const posts = parseFeed(await get(FEED_URL));
    // Each article's picture and search description, from its page (keeping
    // last time's when a page fails).
    const before = new Map(cache?.posts.map((p) => [p.url, p]) ?? []);
    await Promise.all(
      posts.map(async (post) => {
        const html = await get(post.url).catch(() => null);
        post.image = html ? ogImage(html) : (before.get(post.url)?.image ?? null);
        const description = html ? ogDescription(html) : null;
        if (description) post.excerpt = description.length > 200 ? `${description.slice(0, 200).replace(/\s+\S*$/, "")}…` : description;
      }),
    );
    cache = { at: Date.now(), posts };
  } catch (error) {
    console.error("Couldn't read the EJS Tech blog feed", error);
    // Try again in 10 minutes rather than on every visit.
    cache = { at: Date.now() - HOUR + 10 * 60 * 1000, posts: cache?.posts ?? [] };
  }
  return cache.posts;
}
