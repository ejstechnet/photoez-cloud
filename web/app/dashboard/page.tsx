import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  // The real check: look the session up in the database. proxy.ts only
  // checked that a cookie exists.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { user } = session;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold tracking-wide text-brand">PhotoEZ Cloud</span>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-semibold">Welcome, {user.name.split(" ")[0]}</h1>
        <p className="mt-2 text-muted">
          {user.businessName ? `${user.businessName} · ` : ""}
          {user.email}
        </p>
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-muted">
          Your galleries and clients will show up here.
        </div>
      </main>
    </div>
  );
}
