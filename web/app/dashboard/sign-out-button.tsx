"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-full border-2 border-white/25 px-4 py-1.5 text-xs font-bold tracking-wider text-white uppercase transition hover:border-lime hover:text-lime"
    >
      Log out
    </button>
  );
}
