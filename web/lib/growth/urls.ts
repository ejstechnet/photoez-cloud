// Turning a post's link into one standard form, so the same post saved from
// a phone, a share link or a notification is recognized as already saved.
// Tested in urls.test.ts.
import type { GROWTH_PLATFORMS } from "./constants";

type Platform = (typeof GROWTH_PLATFORMS)[number];

// Query keys that only say how someone got to the page, never which page.
const TRACKING_KEYS = new Set([
  "fbclid",
  "gclid",
  "mibextid",
  "rdid",
  "ref",
  "ref_source",
  "ref_campaign",
  "share_id",
  "sfnsn",
  "igsh",
  "si",
  "s",
  "context",
]);

// Phone and old-style hosts that show the same page as the main site.
const HOST_ALIASES: Record<string, string> = {
  "facebook.com": "www.facebook.com",
  "m.facebook.com": "www.facebook.com",
  "mbasic.facebook.com": "www.facebook.com",
  "web.facebook.com": "www.facebook.com",
  "touch.facebook.com": "www.facebook.com",
  "reddit.com": "www.reddit.com",
  "old.reddit.com": "www.reddit.com",
  "new.reddit.com": "www.reddit.com",
  "np.reddit.com": "www.reddit.com",
  "m.reddit.com": "www.reddit.com",
};

// The standard form of a post link, or null when it isn't a web link.
export function canonicalUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  url.protocol = "https:";
  url.hostname = HOST_ALIASES[host] ?? host;
  url.hash = "";
  url.username = "";
  url.password = "";

  const kept = [...url.searchParams].filter(([key]) => {
    const k = key.toLowerCase();
    // Facebook adds __cft__[0], __tn__ and friends to every link it shows.
    return !TRACKING_KEYS.has(k) && !k.startsWith("utm_") && !k.startsWith("__");
  });
  kept.sort(([a], [b]) => a.localeCompare(b));
  url.search = new URLSearchParams(kept).toString();

  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

// Which kind of place a link points to, for filters and the community rules.
export function platformFromUrl(url: string): Platform {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(host)) return "facebook";
  if (/(^|\.)(reddit\.com|redd\.it)$/.test(host)) return "reddit";
  return "web";
}
