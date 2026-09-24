import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { updateClient } from "../actions";
import { ClientForm } from "../client-form";
import { DeleteClientButton } from "./delete-client-button";

export default async function EditClientPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  // Scoped to this photographer: another studio's client id shows "not found".
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.photographerId, user.id)));
  if (!client) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold">{client.name}</h1>
      <p className="mt-1 text-sm text-muted">
        Client since {client.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </p>
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <ClientForm action={updateClient.bind(null, client.id)} defaultValues={client} submitLabel="Save changes" />
      </div>
      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Delete this client</p>
          <p className="text-sm text-muted">Their galleries stay, but won&apos;t be linked to a client anymore.</p>
        </div>
        <DeleteClientButton clientId={client.id} clientName={client.name} />
      </div>
    </div>
  );
}
