import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, clients, invoices, photographers, sessionCredits } from "@/db/schema";
import { CopyLink } from "@/components/copy-link";
import { clientReferralLink } from "@/lib/client-referrals";
import { formatPrice } from "@/lib/booking/format";
import { localDateOf } from "@/lib/booking/time";
import { Avatar } from "@/components/avatar";
import { InvoiceStatusBadge } from "@/components/invoice-document";
import { isOverdue } from "@/lib/invoices/math";
import { requirePhotographer } from "@/lib/session";
import { updateClient } from "../actions";
import { ClientForm } from "../client-form";
import { CreditsCard } from "./credits-card";
import { DeleteClientButton } from "./delete-client-button";
import { TextConsent } from "./text-consent";
import { consentFor, textingOn } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";

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
  // Their share-with-a-friend link, and the friends who booked through it.
  const share = await clientReferralLink(user.id, client.email);
  const [referred] = share
    ? await db
        .select({ friends: count(), rewarded: count(bookings.referralRewardedAt) })
        .from(bookings)
        .where(and(eq(bookings.referredByClientId, client.id), isNotNull(bookings.referredByClientId)))
    : [null];
  // Their quotes and invoices.
  const clientInvoices = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.photographerId, user.id), eq(invoices.clientId, client.id)))
    .orderBy(desc(invoices.createdAt))
    .limit(50);
  // Text reminders: shown when the studio texts.
  const texting = await textingOn(user.id);
  const e164 = toE164(client.phone);
  const textStatus = texting && e164 ? await consentFor(user.id, e164) : null;
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
      <section className="card mt-8 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">Quotes &amp; invoices</h2>
          <div className="flex gap-2">
            <Link href={`/dashboard/invoices/new?kind=quote&client=${client.id}`} className="btn-secondary">
              New quote
            </Link>
            <Link href={`/dashboard/invoices/new?kind=invoice&client=${client.id}`} className="btn-secondary">
              New invoice
            </Link>
          </div>
        </div>
        {clientInvoices.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {clientInvoices.map((i) => (
              <li key={i.id}>
                <Link href={`/dashboard/invoices/${i.id}`} className="flex items-center gap-3 py-3 hover:text-lime-ink">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{i.title}</span>
                    <span className="font-mono text-xs text-muted">{i.number}</span>
                  </span>
                  <InvoiceStatusBadge kind={i.kind} status={i.status} overdue={isOverdue(i.schedule, i.paidCents, i.status, today)} />
                  <span className="w-20 text-right font-semibold tabular-nums">{formatPrice(i.totalCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {texting && <TextConsent clientId={client.id} phone={e164} status={textStatus} />}
      <CreditsCard clientId={client.id} hasEmail={Boolean(client.email)} credits={credits} balanceCents={balanceCents} />
      {share && (
        <section className="card mt-8 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold">Share link</h2>
          <p className="mt-1 text-sm text-muted">
            Friends who book their first session through this link get {formatPrice(share.discountCents)} off;{" "}
            {client.name.split(" ")[0]} gets {formatPrice(share.rewardCents)} of credit after each friend&rsquo;s
            session. It&rsquo;s also on their booking page and in their final photos email.
          </p>
          <div className="mt-4">
            <CopyLink url={share.url} label={`${client.name}'s share link`} />
          </div>
          {referred && referred.friends > 0 && (
            <p className="mt-3 text-sm font-semibold">
              {referred.friends} {referred.friends === 1 ? "friend has" : "friends have"} booked · {referred.rewarded}{" "}
              {referred.rewarded === 1 ? "credit" : "credits"} earned
            </p>
          )}
        </section>
      )}
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
