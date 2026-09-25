// Rules for a studio's public page address: photoezcloud.com/studio/<slug>

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

// Words that could be confused with app pages or used to impersonate PhotoEZ.
const RESERVED = new Set(["admin", "api", "app", "dashboard", "login", "signup", "settings", "studio", "photoez", "support", "help"]);

export function isAllowedSlug(slug: string) {
  return SLUG_PATTERN.test(slug) && !slug.includes("--") && !RESERVED.has(slug);
}

// "Elle Jones Studios" -> "elle-jones-studios"
export function suggestSlug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}
