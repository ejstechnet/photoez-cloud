import { cache } from "react";
import { notFound } from "next/navigation";
import { requirePhotographer } from "@/lib/session";
import { isOwnerEmail } from "@/lib/signup-stats";

export { isOwnerEmail };

// The logged-in PhotoEZ Cloud owner (OWNER_EMAILS in .env), or a plain "not
// found" for everyone else, so the page doesn't reveal it exists.
export const requireOwner = cache(async () => {
  const user = await requirePhotographer();
  if (!isOwnerEmail(user.email)) notFound();
  return user;
});
