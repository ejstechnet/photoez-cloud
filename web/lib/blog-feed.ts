// Reads the EJS Tech blog's RSS feed (WordPress, ejstech.net/feed/) into
// plain article cards for the home page and /articles. Pure parsing, no
// network, so it's tested in blog-feed.test.ts; lib/blog.ts fetches it.

export type BlogPost = {
  title: string;
  url: string;
  date: string; // ISO date, e.g. "2026-08-17"
  category: string | null;
  excerpt: string;
  image: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

function tag(item: string, name: string) {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(item);
  if (!match) return null;
  return match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

// A short, clean excerpt: tags removed, and WordPress's habit of starting the
// excerpt with the post title (sometimes twice) trimmed off.
export function cleanExcerpt(html: string, title: string, max = 180) {
  let text = decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  text = text.replace(/\[…\]|\[&hellip;\]|\[\.\.\.\]/g, "").trim();
  for (let i = 0; i < 2 && title && text.startsWith(title); i++) text = text.slice(title.length).trim();
  if (text.length > max) text = `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
  return text;
}

export function parseFeed(xml: string): BlogPost[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.flatMap((item) => {
    const title = decodeEntities(tag(item, "title") ?? "").trim();
    const url = (tag(item, "link") ?? "").trim();
    if (!title || !/^https:\/\//.test(url)) return [];
    const pub = new Date(tag(item, "pubDate") ?? "");
    return [
      {
        title,
        url,
        date: Number.isNaN(pub.getTime()) ? "" : pub.toISOString().slice(0, 10),
        category: tag(item, "category") ? decodeEntities(tag(item, "category")!) : null,
        excerpt: cleanExcerpt(tag(item, "description") ?? "", title),
        image: null,
      },
    ];
  });
}

// The article's share image, from its page's og:image tag.
export function ogImage(html: string): string | null {
  const match = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
  return match && /^https:\/\//.test(match[1]) ? decodeEntities(match[1]) : null;
}

// The article's own search description (og:description), when it's a real
// sentence; short ones that just repeat the title aren't used.
export function ogDescription(html: string): string | null {
  const match = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i.exec(html);
  const text = match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : "";
  return text.length >= 80 ? text : null;
}
