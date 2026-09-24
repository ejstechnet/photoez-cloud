import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";

export default async function ClientsPage() {
  const user = await requirePhotographer();
  const rows = await db
    .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone })
    .from(clients)
    .where(eq(clients.photographerId, user.id))
    .orderBy(asc(clients.name));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Clients</h1>
          <p className="mt-1 text-muted">
            {rows.length === 1 ? "1 client" : `${rows.length} clients`}
          </p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="rounded-lg bg-brand px-4 py-2.5 font-medium text-brand-foreground hover:opacity-90"
        >
          Add client
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-medium">No clients yet</p>
          <p className="mt-1 text-sm text-muted">Add your first client to start building galleries for them.</p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((client) => (
            <li key={client.id}>
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-background sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium">{client.name}</span>
                <span className="text-sm text-muted">
                  {[client.email, client.phone].filter(Boolean).join(" · ") || "No contact details"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
