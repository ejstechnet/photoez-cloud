"use server";

import { headers } from "next/headers";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { auth } from "@/lib/auth";
import { cleanSource } from "@/lib/leads";

// Right after sign-up: remember where the new studio came from (the landing
// page's ?src=, e.g. a Facebook ad), with the address they signed up with.
// Only for the signed-in account, so nobody can add other addresses.
export async function recordSignupSource(src: string | null) {
  const source = cleanSource(src);
  if (!source) return;
  const session = await auth.api.getSession({ headers: await headers() });
  const email = session?.user.email?.toLowerCase();
  if (!email) return;
  await db.insert(leads).values({ email, source }).onConflictDoNothing({ target: leads.email });
}
