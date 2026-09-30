// Helpers for the campaign landing page's email capture (app/join).

// One address, no spaces, something@something.tld. Real checking happens when
// they sign up; this only stops typos and junk from filling the list.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

// Where the visitor came from (?src=facebook-ad), kept short and plain.
export function cleanSource(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const source = input.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return source || null;
}
