import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { leads, photographers } from "@/db/schema";
import { isOwnerEmail, signupStatus } from "@/lib/signup-stats";

// Every studio that has signed up, newest first, with the landing page's tag
// (?src=) when there was one. Studios from a plain link have no leads row, so
// they're listed with no tag; before 2026-10-21 the page only showed tagged
// ones, which hid sign-ups from untagged links. Also lists addresses left on
// the old email-first landing page that never made an account. The owner's
// own studio isn't a sign-up, so it's left out.
export async function allSignups() {
  const [studios, leftOnly] = await Promise.all([
    db
      .select({
        email: photographers.email,
        source: leads.source,
        quiz: leads.quiz,
        createdAt: photographers.createdAt,
        name: photographers.name,
        businessName: photographers.businessName,
        plan: photographers.plan,
        trialEndsAt: photographers.trialEndsAt,
        emailVerified: photographers.emailVerified,
      })
      .from(photographers)
      .leftJoin(leads, eq(leads.email, photographers.email))
      .orderBy(desc(photographers.createdAt)),
    db
      .select({ email: leads.email, source: leads.source, quiz: leads.quiz, createdAt: leads.createdAt })
      .from(leads)
      .leftJoin(photographers, eq(photographers.email, leads.email))
      .where(isNull(photographers.id)),
  ]);

  const rows = [
    ...studios.map((r) => ({ ...r, hasAccount: true, status: signupStatus(r.plan, r.trialEndsAt) })),
    ...leftOnly.map((r) => ({
      ...r,
      name: null,
      businessName: null,
      emailVerified: false,
      hasAccount: false,
      status: signupStatus(null, null),
    })),
  ];
  return rows
    .filter((r) => !isOwnerEmail(r.email))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
