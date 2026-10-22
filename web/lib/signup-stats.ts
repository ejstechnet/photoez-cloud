// The Sign-ups page's counting and spreadsheet helpers (no database, so
// they're tested in signup-stats.test.ts).
import { trialDaysLeft } from "./plans.ts";

// "Pro trial", the plan they're on, or "No account" (an address left on the
// old email-first landing page without finishing sign-up).
export function signupStatus(plan: string | null, trialEndsAt: Date | null): string {
  if (!plan) return "No account";
  if (plan === "free") return trialDaysLeft(trialEndsAt) > 0 ? "Pro trial" : "Free";
  return plan === "pro" ? "Pro" : "Studio";
}

// The label for studios that came from a plain link (no ?src= tag).
export const NO_TAG = "No tag";

// Per tag: how many signed up, and how many now pay.
export function bySource(rows: { source: string | null; status: string }[]) {
  const map = new Map<string, { source: string; signups: number; paying: number }>();
  for (const r of rows) {
    const key = r.source ?? NO_TAG;
    const s = map.get(key) ?? { source: key, signups: 0, paying: 0 };
    s.signups++;
    if (r.status === "Pro" || r.status === "Studio") s.paying++;
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => b.signups - a.signups);
}

// The top of the Sign-ups page: studios that made an account, how many
// confirmed their email (a low number points at the confirmation email, not
// at interest), and how many are trying Pro or paying. Addresses with no
// account aren't studios, so they're left out of every count.
export function signupTotals(rows: { hasAccount: boolean; emailVerified: boolean; status: string }[]) {
  const studios = rows.filter((r) => r.hasAccount);
  return {
    studios: studios.length,
    confirmed: studios.filter((r) => r.emailVerified).length,
    onTrial: studios.filter((r) => r.status === "Pro trial").length,
    paying: studios.filter((r) => r.status === "Pro" || r.status === "Studio").length,
  };
}

// A spreadsheet-safe CSV cell (quoted when needed; never runs as a formula).
export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// The PhotoEZ Cloud owner (Elle): the accounts that see site-wide pages like
// Sign-ups. OWNER_EMAILS in .env, comma-separated; empty = nobody.
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const owners = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(email.trim().toLowerCase());
}
