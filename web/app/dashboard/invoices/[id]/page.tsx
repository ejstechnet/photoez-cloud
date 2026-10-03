import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invoices, payments, photographers } from "@/db/schema";
import { CopyLink } from "@/components/copy-link";
import { InvoiceDocument } from "@/components/invoice-document";
import { formatPrice } from "@/lib/booking/format";
import { formatDate } from "@/lib/booking/time";
import { describePlan, formatDay } from "@/lib/invoices/math";
import { invoiceUrl, studioToday } from "@/lib/invoices/server";
import { requirePhotographer } from "@/lib/session";
import { ConfirmButton } from "../../bookings/confirm-button";
import { cancelInvoice, deleteInvoice, duplicateInvoice, markApproved, removeRecordedPayment } from "../actions";
import { RecordPaymentForm, SendButton } from "./invoice-tools";

export const metadata = { title: "Quote or invoice · PhotoEZ Cloud" };

export default async function InvoicePage({ params, searchParams }: PageProps<"/dashboard/invoices/[id]">) {
  const { id } = await params;
  const { sent: justSent } = await searchParams;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();
  const [row] = await db
    .select({ invoice: invoices, studioName: photographers.name, businessName: photographers.businessName, email: photographers.email, notifyEmail: photographers.notifyEmail, timeZone: photographers.timeZone })
    .from(invoices)
    .innerJoin(photographers, eq(photographers.id, invoices.photographerId))
    .where(and(eq(invoices.id, id), eq(invoices.photographerId, user.id)));
  if (!row) notFound();
  const { invoice, timeZone } = row;
  const online = await db
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoice.id), eq(payments.status, "paid")))
    .orderBy(asc(payments.paidAt));

  const today = studioToday(timeZone);
  const editable = (invoice.status === "draft" || invoice.status === "sent") && invoice.paidCents === 0 && !invoice.signedAt;
  const live = invoice.status !== "draft" && invoice.status !== "cancelled" && invoice.status !== "declined";
  const when = (d: Date) => `${formatDate(d, timeZone, "short")}, ${d.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" })}`;
  const word = invoice.kind === "quote" ? "quote" : "invoice";

  const history: [string, string][] = [];
  history.push(["Created", when(invoice.createdAt)]);
  if (invoice.sentAt) history.push(["Sent", when(invoice.sentAt)]);
  if (invoice.viewedAt) history.push(["First viewed", when(invoice.viewedAt)]);
  if (invoice.approvedAt) history.push(["Approved", when(invoice.approvedAt)]);
  if (invoice.declinedAt) history.push(["Declined", `${when(invoice.declinedAt)}${invoice.declineReason ? `: “${invoice.declineReason}”` : ""}`]);
  if (invoice.signedAt) history.push(["Contract signed", `${when(invoice.signedAt)} by ${invoice.signerName}`]);
  if (invoice.paidAt) history.push(["Paid in full", when(invoice.paidAt)]);
  if (invoice.cancelledAt) history.push(["Cancelled", when(invoice.cancelledAt)]);

  return (
    <div>
      <Link href="/dashboard/invoices" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Quotes &amp; invoices
      </Link>
      {justSent === "1" && (
        <p className="mt-4 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
          Sent to {invoice.clientEmail}. You&apos;ll get an email when they {invoice.kind === "quote" ? "approve it" : "pay"}.
        </p>
      )}
      {justSent === "0" && (
        <p className="mt-4 rounded-2xl bg-sun/30 px-5 py-4 font-medium">
          Saved, but the email didn&apos;t go out. Check the{" "}
          <Link href="/dashboard/emails" className="link">
            Email log
          </Link>
          , or copy the client&apos;s link below and send it yourself.
        </p>
      )}
      {invoice.status === "draft" && (
        <p className="mt-4 rounded-2xl bg-sun/30 px-5 py-4 font-medium">This is a draft. The client can&apos;t see it until you send it.</p>
      )}

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <InvoiceDocument
          invoice={invoice}
          studio={{ name: row.businessName || row.studioName, email: row.notifyEmail || row.email }}
          today={today}
        />

        <aside className="space-y-6">
          <section className="card space-y-4 p-6">
            <h2 className="font-display text-xl font-bold">Share</h2>
            {invoice.status !== "cancelled" && invoice.status !== "declined" && invoice.status !== "paid" && (
              <SendButton id={invoice.id} label={invoice.status === "draft" ? `Send ${word}` : `Email ${word} again`} email={invoice.clientEmail} />
            )}
            {live && (
              <div>
                <p className="mb-1.5 text-sm font-semibold">Client&apos;s link</p>
                <CopyLink url={invoiceUrl(invoice.token)} label="The client's link" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {editable && (
                <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="rounded-full border-2 border-border px-5 py-2 text-xs font-bold tracking-wider uppercase hover:border-lime-ink hover:bg-lime/15">
                  Edit
                </Link>
              )}
              {live && (
                <a href={invoiceUrl(invoice.token)} target="_blank" className="rounded-full border-2 border-border px-5 py-2 text-xs font-bold tracking-wider uppercase hover:border-lime-ink hover:bg-lime/15">
                  View as client
                </a>
              )}
              {invoice.kind === "quote" && invoice.status === "sent" && (
                <ConfirmButton action={markApproved.bind(null, invoice.id)} confirmText="Mark this quote approved? Do this when the client said yes another way." pendingLabel="Saving…">
                  Mark approved
                </ConfirmButton>
              )}
            </div>
          </section>

          <section className="card space-y-3 p-6">
            <h2 className="font-display text-xl font-bold">Payments</h2>
            <p className="text-sm text-muted">{describePlan(invoice.plan)}</p>
            {online.length === 0 && invoice.manualPayments.length === 0 ? (
              <p className="text-sm text-muted">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {online.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-2">
                    <span>
                      Card (online)
                      <span className="block text-xs text-muted">{p.paidAt ? formatDate(p.paidAt, timeZone, "short") : ""}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{formatPrice(p.amountCents)}</span>
                  </li>
                ))}
                {invoice.manualPayments.map((p, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      {p.note}
                      <span className="block text-xs text-muted">{formatDay(p.date, "short")} · recorded by you</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums">{formatPrice(p.amountCents)}</span>
                      <ConfirmButton action={removeRecordedPayment.bind(null, invoice.id, i)} confirmText="Remove this recorded payment?" pendingLabel="…" danger>
                        Remove
                      </ConfirmButton>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {live && invoice.status !== "paid" && <RecordPaymentForm id={invoice.id} today={today} />}
          </section>

          {invoice.contractTemplateId || invoice.signedAt ? (
            <section className="card space-y-2 p-6">
              <h2 className="font-display text-xl font-bold">Contract</h2>
              {invoice.signedAt ? (
                <p className="text-sm">
                  Signed by <strong>{invoice.signerName}</strong> on {formatDate(invoice.signedAt, timeZone, "short")}.
                </p>
              ) : (
                <p className="text-sm text-muted">Not signed yet. The client signs it before paying.</p>
              )}
              {live && (
                <a href={`${invoiceUrl(invoice.token)}/contract`} target="_blank" className="link text-sm">
                  {invoice.signedAt ? "View signed contract" : "Preview contract"}
                </a>
              )}
            </section>
          ) : null}

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">History</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {history.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-bold tracking-wider text-muted uppercase">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card flex flex-wrap gap-2 p-6">
            <ConfirmButton action={duplicateInvoice.bind(null, invoice.id, invoice.kind)} pendingLabel="Copying…">
              Make a copy
            </ConfirmButton>
            {invoice.kind === "quote" && (
              <ConfirmButton action={duplicateInvoice.bind(null, invoice.id, "invoice")} pendingLabel="Copying…">
                Copy as invoice
              </ConfirmButton>
            )}
            {invoice.status !== "cancelled" && invoice.status !== "paid" && invoice.status !== "draft" && (
              <ConfirmButton
                action={cancelInvoice.bind(null, invoice.id)}
                confirmText={`Cancel ${invoice.number}? The client won't be able to ${invoice.kind === "quote" ? "approve or pay it" : "pay it"}.`}
                pendingLabel="Cancelling…"
                danger
              >
                Cancel {word}
              </ConfirmButton>
            )}
            {(invoice.status === "draft" || invoice.status === "cancelled") && (
              <ConfirmButton action={deleteInvoice.bind(null, invoice.id)} confirmText={`Delete ${invoice.number} for good?`} pendingLabel="Deleting…" danger>
                Delete
              </ConfirmButton>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
