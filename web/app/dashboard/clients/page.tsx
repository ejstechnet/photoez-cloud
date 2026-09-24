import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { Avatar } from "@/components/avatar";
import { ArrowRightIcon, PlusIcon, UsersIcon } from "@/components/icons";
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-wider text-coral uppercase">
            {rows.length === 1 ? "1 client" : `${rows.length} clients`}
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Clients</h1>
        </div>
        <Link href="/dashboard/clients/new" className="btn-primary">
          <PlusIcon size={18} /> Add client
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-10 flex flex-col items-center border-2 border-dashed px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-coral text-brand-deep">
            <UsersIcon size={28} />
          </span>
          <p className="mt-5 font-display text-2xl font-bold">Add your first client</p>
          <p className="mt-2 max-w-sm text-muted">Clients are the people you shoot for. Galleries get built for them.</p>
          <Link href="/dashboard/clients/new" className="btn-primary mt-6">
            Add client <ArrowRightIcon size={18} />
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-3">
          {rows.map((client) => (
            <li key={client.id}>
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="card group flex items-center gap-4 px-5 py-4 transition hover:-translate-y-0.5 hover:border-lime hover:shadow-lg"
              >
                <Avatar name={client.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{client.name}</p>
                  <p className="truncate text-sm text-muted">
                    {[client.email, client.phone].filter(Boolean).join(" · ") || "No contact details yet"}
                  </p>
                </div>
                <ArrowRightIcon size={18} className="shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-lime-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
