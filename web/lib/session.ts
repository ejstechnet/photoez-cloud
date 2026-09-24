import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Returns the logged-in photographer, or sends the visitor to the login page.
// Every page and server action that touches studio data starts here, and
// every query is then scoped to this photographer's id.
export const requirePhotographer = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session.user;
});
