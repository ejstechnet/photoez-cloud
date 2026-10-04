import { ogDescription, ogImage, parseFeed, type BlogPost } from "./blog-feed";

// The EJS Tech blog's articles (ejstech.net), shown on the home page and at
// /articles. Read from the WordPress feed at most once an hour and kept in
// memory; if the blog is slow or down, the last good copy (or nothing) is
// shown, and the page never waits more than a few seconds.
//
// Each card's picture comes from its article page (og:image). Those pages
// take a couple of seconds each, so they're read in the background, a few at
// a time, never while a visitor waits; a picture that couldn't be read is
// tried again in 10 minutes instead of staying blank for an hour.

export const BLOG_URL = "https://ejstech.net/ejs-tech-blog/";
const FEED_URL = "https://ejstech.net/feed/";
const HOUR = 60 * 60 * 1000;
const RETRY = 10 * 60 * 1000;
// Article pages read at once.
const AT_ONCE = 3;

let cache: { at: number; posts: BlogPost[] } | null = null;
let refreshing: Promise<void> | null = null;

async function get(url: string, ms: number) {
  const response = await fetch(url, { headers: { "User-Agent": "PhotoEZ Cloud (+https://photoezcloud.com)" }, signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

export async function blogPosts(): Promise<BlogPost[]> {
  if (!cache) {
    // First visit since the server started: wait for the feed itself (quick),
    // and let the pictures fill in behind it.
    await refresh();
  } else if (Date.now() - cache.at >= HOUR) {
    void refresh();
  }
  return cache?.posts ?? [];
}

// Reads the feed, then each article's picture and description. Only one runs at a time.
function refresh() {
  refreshing ??= (async () => {
    try {
      const posts = parseFeed(await get(FEED_URL, 4000));
      // Keep last time's pictures and descriptions until the pages are read again.
      const before = new Map(cache?.posts.map((p) => [p.url, p]) ?? []);
      for (const post of posts) {
        const old = before.get(post.url);
        post.image = old?.image ?? null;
        if (old?.excerpt) post.excerpt = old.excerpt;
      }
      cache = { at: Date.now(), posts };
      void details(posts).finally(() => {
        // Some still without a picture: try again sooner than the hour.
        if (cache?.posts === posts && posts.some((p) => !p.image)) cache.at = Date.now() - HOUR + RETRY;
      });
    } catch (error) {
      console.error("Couldn't read the EJS Tech blog feed", error);
      // Try again in 10 minutes rather than on every visit.
      cache = { at: Date.now() - HOUR + RETRY, posts: cache?.posts ?? [] };
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// Each article page's picture and search description, a few pages at a time.
async function details(posts: BlogPost[]) {
  const queue = [...posts];
  await Promise.all(
    Array.from({ length: AT_ONCE }, async () => {
      for (let post = queue.shift(); post; post = queue.shift()) {
        const html = await get(post.url, 15_000).catch(() => null);
        if (!html) continue;
        post.image = ogImage(html) ?? post.image;
        const description = ogDescription(html);
        if (description) post.excerpt = description.length > 200 ? `${description.slice(0, 200).replace(/\s+\S*$/, "")}…` : description;
      }
    }),
  );
}
