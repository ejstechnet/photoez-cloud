import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, photographers, sessionCredits } from "@/db/schema";
import { localDateOf } from "@/lib/booking/time";
import { Avatar } from "@/components/avatar";
import { requirePhotographer } from "@/lib/session";
import { updateClient } from "../actions";
import { ClientForm } from "../client-form";
import { CreditsCard } from "./credits-card";
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

  // Session credits matched to this client's email.
  const [studio] = await db
    .select({ timeZone: photographers.timeZone })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const today = localDateOf(new Date(), studio.timeZone);
  const credits = client.email
    ? (
        await db
          .select()
          .from(sessionCredits)
          .where(and(eq(sessionCredits.photographerId, user.id), eq(sessionCredits.clientEmail, client.email.toLowerCase())))
          .orderBy(desc(sessionCredits.createdAt))
      ).map((c) => ({ ...c, expired: c.expiresOn !== null && c.expiresOn < today }))
    : [];
  const balanceCents = credits
    .filter((c) => !c.expired)
    .reduce((sum, c) => sum + c.amountCents - c.usedCents, 0);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4">
        <Avatar name={client.name} size="lg" />
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">{client.name}</h1>
          <p className="mt-1 text-sm font-semibold text-muted">
            Client since {client.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
      <div className="card mt-8 p-6 sm:p-8">
        <ClientForm action={updateClient.bind(null, client.id)} defaultValues={client} submitLabel="Save changes" />
      </div>
      <CreditsCard clientId={client.id} hasEmail={Boolean(client.email)} credits={credits} balanceCents={balanceCents} />
      <div className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Delete this client</p>
          <p className="text-sm text-muted">Their galleries stay, but won&apos;t be linked to a client anymore.</p>
        </div>
        <DeleteClientButton clientId={client.id} clientName={client.name} />
      </div>
    </div>
  );
}
