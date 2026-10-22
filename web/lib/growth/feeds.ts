// Reading RSS and Atom feeds for automatic finding: Google Alerts set to
// "Deliver to: RSS feed" (the main source), or any public feed Elle may read,
// like a forum's new-threads feed. Small and dependency-free on purpose: the
// feeds are simple, and nothing in them is trusted. Tested in feeds.test.ts.
//
// Brave Search was considered and dropped (2026-10-22): its terms forbid
// storing search results, which saving found posts would do.

export type FeedItem = { title: string; url: string; summary: string; publishedAt: Date | null; id: string | null };

const MAX_ITEMS = 100;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

// Feed text to plain text: CDATA unwrapped, entities decoded (feeds often
// escape their HTML, so tags are stripped after decoding too), one space.
export function plainText(raw: string): string {
  let text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 2; i++) text = decodeEntities(text.replace(/<[^>]*>/g, " "));
  // A removed inline tag (<b>HoneyBook</b>,) leaves a space before punctuation.
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ ([,.!?;:])/g, "$1")
    .trim();
}

// Google Alerts links go through google.com/url?…&url=<the real page>.
export function unwrapGoogleUrl(link: string): string {
  try {
    const u = new URL(link);
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("url") ?? u.searchParams.get("q") ?? link;
  } catch {
    // Not a full URL; returned as is and refused later.
  }
  return link;
}

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1] ?? "";

function dateOf(text: string): Date | null {
  const d = new Date(plainText(text));
  return Number.isNaN(d.getTime()) ? null : d;
}

// The items in an RSS 2.0 or Atom feed, newest first as the feed lists them.
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks.slice(0, MAX_ITEMS)) {
    const atomLink =
      block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
      block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1];
    const rawUrl = decodeEntities(atomLink ?? plainText(tag(block, "link")));
    const url = unwrapGoogleUrl(rawUrl.trim());
    if (!/^https?:\/\//i.test(url)) continue;
    items.push({
      title: plainText(tag(block, "title")).slice(0, 300),
      url,
      summary: plainText(tag(block, "content") || tag(block, "summary") || tag(block, "description")).slice(0, 4000),
      publishedAt: dateOf(tag(block, "published") || tag(block, "pubDate") || tag(block, "updated") || tag(block, "dc:date")),
      id: plainText(tag(block, "guid") || tag(block, "id")).slice(0, 500) || null,
    });
  }
  return items;
}

// Brand names and phrases that mean "photography business software", for
// feeds that aren't already keyword searches (a forum's every new thread).
const CORE_TERMS = [
  "pixieset",
  "honeybook",
  "shootproof",
  "pic-time",
  "pictime",
  "cloudspot",
  "dubsado",
  "studio ninja",
  "17hats",
  "sprout studio",
  "client gallery",
  "client galleries",
  "proofing",
  "booking software",
  "booking system",
  "contract software",
  "crm",
  "invoicing",
  "gallery delivery",
  "client management",
  "studio management",
];

const hasPhrase = (text: string, phrase: string) =>
  new RegExp(`(^|[^a-z0-9])${phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(text);

// Whether a feed item is about what Growth looks for, by Elle's phrases or
// the core terms; a negative phrase (camera advice, hiring) rules it out.
export function matchesInterest(text: string, phrases: string[], negatives: string[]): boolean {
  const t = text.toLowerCase();
  if (negatives.some((n) => hasPhrase(t, n))) return false;
  return [...phrases, ...CORE_TERMS].some((p) => hasPhrase(t, p));
}
