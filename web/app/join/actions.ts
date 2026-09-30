"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { cleanSource, normalizeEmail } from "@/lib/leads";

// The landing page's form: save the address, then send them on to sign up
// with it filled in. Saved first, so the address is kept even if they never
// finish signing up.
export async function joinAction(formData: FormData) {
  const source = cleanSource(formData.get("src"));
  const back = (error?: string) => {
    const params = new URLSearchParams();
    if (source) params.set("src", source);
    if (error) params.set("error", error);
    return `/join${params.size ? `?${params}` : ""}`;
  };

  // A hidden field real visitors never fill in; bots do. Pretend it worked.
  if (String(formData.get("website") ?? "") !== "") redirect("/signup");

  const email = normalizeEmail(formData.get("email"));
  if (!email) redirect(back("email"));

  await db.insert(leads).values({ email, source }).onConflictDoNothing({ target: leads.email });

  const next = new URLSearchParams({ email });
  redirect(`/signup?${next}`);
}
