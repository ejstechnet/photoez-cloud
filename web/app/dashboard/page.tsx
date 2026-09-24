import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requirePhotographer();
  const [{ clientCount }] = await db
    .select({ clientCount: count() })
    .from(clients)
    .where(eq(clients.photographerId, user.id));

  return (
    <>
      <h1 className="text-3xl font-semibold">Welcome, {user.name.split(" ")[0]}</h1>
      <p className="mt-2 text-muted">
        {user.businessName ? `${user.businessName} · ` : ""}
        {user.email}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/clients"
          className="rounded-2xl border border-border bg-surface p-6 transition hover:border-brand"
        >
          <p className="text-sm font-medium text-muted">Clients</p>
          <p className="mt-2 text-3xl font-semibold">{clientCount}</p>
        </Link>
        <div className="rounded-2xl border border-dashed border-border p-6 text-muted">
          <p className="text-sm font-medium">Galleries</p>
          <p className="mt-2 text-sm">Coming soon.</p>
        </div>
      </div>
    </>
  );
}
