import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { leads, photographers } from "@/db/schema";
import { signupStatus } from "@/lib/signup-stats";

// Tracked sign-ups (the landing page's ?src=), with where each studio is now.
export async function trackedSignups() {
  const rows = await db
    .select({
      email: leads.email,
      source: leads.source,
      createdAt: leads.createdAt,
      name: photographers.name,
      businessName: photographers.businessName,
      plan: photographers.plan,
      trialEndsAt: photographers.trialEndsAt,
    })
    .from(leads)
    .leftJoin(photographers, eq(photographers.email, leads.email))
    .orderBy(desc(leads.createdAt));
  return rows.map((r) => ({ ...r, status: signupStatus(r.plan, r.trialEndsAt) }));
}
