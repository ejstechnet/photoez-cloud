import { createHmac, timingSafeEqual } from "node:crypto";

// Unsubscribe links in the owner's emails to studios (Settings > Email
// studios): <studio id>.<signature>, signed with BETTER_AUTH_SECRET so a link
// can't be made up for someone else, and nothing extra is stored.
// Tested in unsubscribe.test.ts.

function signature(studioId: string, secret: string) {
  return createHmac("sha256", secret).update(`unsubscribe:${studioId}`).digest("base64url").slice(0, 32);
}

export function unsubscribeToken(studioId: string, secret = process.env.BETTER_AUTH_SECRET) {
  if (!secret) throw new Error("BETTER_AUTH_SECRET is missing.");
  return `${studioId}.${signature(studioId, secret)}`;
}

// The studio id, or null when the link was changed or made up.
export function studioFromUnsubscribeToken(token: string, secret = process.env.BETTER_AUTH_SECRET): string | null {
  if (!secret) return null;
  const [studioId, given] = token.split(".");
  if (!studioId || !given || !/^[0-9a-f-]{36}$/i.test(studioId)) return null;
  const expected = Buffer.from(signature(studioId, secret));
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? studioId : null;
}
