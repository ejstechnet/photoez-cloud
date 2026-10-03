import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { InvoiceDocument } from "@/components/invoice-document";
import { StudioBar, StudioFooter } from "@/app/studio/[slug]/studio-bar";
import { PrintButton } from "@/app/booking/[token]/contract/print-button";
import { formatPrice } from "@/lib/booking/format";
import { canPay, formatDay, nextScheduled } from "@/lib/invoices/math";
import { amountToPay, findClientInvoice, needsSignature, studioToday } from "@/lib/invoices/server";
import { signedViewUrl } from "@/lib/storage";
import { QuoteAnswer } from "./quote-answer";

// A client's quote or invoice, from the private link in their email (like
// InvoiceEZ's client page): approve or decline a quote, sign the contract,
// pay the next payment or the whole balance, and print or save a PDF.

export const metadata: Metadata = { title: "Your quote or invoice", robots: { index: false } };

export default async function ClientInvoicePage({ params, searchParams }: PageProps<"/i/[token]">) {
  const { token } = await params;
  const query = await searchParams;
  const found = await findClientInvoice(token);
  if (!found) notFound();
  const { invoice, name, timeZone } = found;
  const logoUrl = found.logoKey ? await signedViewUrl(found.logoKey) : null;
  const today = studioToday(timeZone);

  // The first time the client opens it (shown in the studio's history).
  if (!invoice.viewedAt) {
    await db.update(invoices).set({ viewedAt: new Date() }).where(and(eq(invoices.id, invoice.id), isNull(invoices.viewedAt)));
  }

  const word = invoice.kind === "quote" ? "quote" : "invoice";
  const payable = canPay(invoice.kind, invoice.status);
  const mustSign = needsSignature(invoice);
  const next = amountToPay(invoice, "next");
  const full = amountToPay(invoice, "full");
  const due = nextScheduled(invoice.schedule, invoice.paidCents);
  const banner =
    query.approved === "1"
      ? "Thank you! Your quote is approved."
      : query.signed === "1"
        ? "Thank you! Your contract is signed."
        : query.changed === "paid"
          ? "Thank you! Your payment went through. A receipt is on its way to your email."
          : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="print:hidden">
        {found.slug ? (
          <StudioBar slug={found.slug} name={name} logoUrl={logoUrl} logoBg={found.logoBg} />
        ) : (
          <div className="bg-brand-deep px-4 py-4 font-display text-lg text-white">{name}</div>
        )}
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 print:py-0">
        <div className="space-y-4 print:hidden">
          {banner && <p className="rounded-2xl bg-lime/20 px-5 py-4 font-semibold">{banner}</p>}

          {invoice.status === "cancelled" && (
            <p className="rounded-2xl bg-danger/10 px-5 py-4 font-semibold text-danger">
              This {word} was cancelled. Questions? Contact {name} at {found.studioEmail}.
            </p>
          )}
          {invoice.status === "declined" && (
            <p className="rounded-2xl bg-border px-5 py-4 font-semibold">You declined this quote. Changed your mind? Contact {name} at {found.studioEmail}.</p>
          )}

          {invoice.kind === "quote" && invoice.status === "sent" && (
            <section className="card p-6">
              <h2 className="font-display text-2xl font-bold">Ready to go ahead?</h2>
              <p className="mt-1 text-sm text-muted">
                Approve this quote to {mustSign ? "sign the contract and " : ""}
                {due ? `pay ${due.label === "Deposit" ? "the deposit" : "online"}` : "get started"}. Want changes? Reply to {name}&apos;s email instead.
              </p>
              <div className="mt-5">
                <QuoteAnswer token={token} />
              </div>
            </section>
          )}

          {payable && mustSign && (
            <section className="card p-6">
              <h2 className="font-display text-2xl font-bold">Next: sign your contract</h2>
              <p className="mt-1 text-sm text-muted">Please read and sign the contract with {name}. Then you can pay online.</p>
              <a href={`/i/${token}/contract`} className="btn-primary mt-5">
                Read &amp; sign the contract
              </a>
            </section>
          )}

          {payable && !mustSign && next && (
            <section className="card p-6">
              <h2 className="font-display text-2xl font-bold">
                {next.label === "Deposit"
                  ? "Pay your deposit"
                  : next.label === "Balance" || next.label === "Payment in full"
                    ? "Pay your balance"
                    : `Your next payment (${next.label.toLowerCase()})`}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {formatPrice(next.amountCents)}
                {due?.dueDate ? `, due ${formatDay(due.dueDate)}` : ", due now"}. Paid securely by card through Stripe.
              </p>
              {found.stripeReady ? (
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <a href={`/i/${token}/pay?amount=next`} className="btn-primary">
                    Pay {formatPrice(next.amountCents)}
                  </a>
                  {full && full.amountCents > next.amountCents && (
                    <a href={`/i/${token}/pay?amount=full`} className="btn-secondary">
                      Pay the full {formatPrice(full.amountCents)}
                    </a>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-sun/30 px-4 py-3 text-sm font-medium">
                  {name} isn&apos;t taking payments online yet. Contact them at {found.studioEmail} to pay.
                </p>
              )}
            </section>
          )}

          {invoice.status === "paid" && <p className="rounded-2xl bg-lime/20 px-5 py-4 font-semibold">Paid in full. Thank you!</p>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {invoice.signedAt ? (
              <a href={`/i/${token}/contract`} className="text-sm font-semibold text-link underline">
                View your signed contract
              </a>
            ) : (
              <span />
            )}
            <PrintButton />
          </div>
        </div>

        <div className="mt-4">
          <InvoiceDocument invoice={invoice} studio={{ name, email: found.studioEmail }} today={today} />
        </div>
      </main>

      <div className="print:hidden">
        <StudioFooter studioId={invoice.photographerId} />
      </div>
    </div>
  );
}
