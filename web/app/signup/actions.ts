"use server";

import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { leads, photographers } from "@/db/schema";
import { cleanSource, normalizeEmail } from "@/lib/leads";
import { overLimit } from "@/lib/rate-limit";

// Right after sign-up: remember where the new studio came from (the landing
// page's ?src=, e.g. a Facebook ad). New studios confirm their email before
// they're signed in, so this goes by the address they just signed up with,
// and only for an account created in the last few minutes, so it can't be
// used to add other addresses.
export async function recordSignupSource(src: string | null, emailInput: string) {
  const source = cleanSource(src);
  const email = normalizeEmail(emailInput);
  if (!source || !email) return;
  if (await overLimit("signup-source", 10, 60 * 60 * 1000)) return;
  const [account] = await db
    .select({ id: photographers.id })
    .from(photographers)
    .where(and(eq(photographers.email, email), gt(photographers.createdAt, new Date(Date.now() - 15 * 60 * 1000))));
  if (!account) return;
  await db.insert(leads).values({ email, source }).onConflictDoNothing({ target: leads.email });
}
