import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StudioBar, StudioFooter } from "@/app/studio/[slug]/studio-bar";
import { PrintButton } from "@/app/booking/[token]/contract/print-button";
import { SignForm } from "@/app/booking/[token]/contract/sign-form";
import { signatureFont } from "@/app/booking/[token]/contract/signature-font";
import { canPay } from "@/lib/invoices/math";
import { filledInvoiceContract, findClientInvoice } from "@/lib/invoices/server";
import { signedViewUrl } from "@/lib/storage";
import { signInvoiceContract } from "../actions";

// A quote or invoice's contract: to sign before paying, or the signed copy
// to view and print from the client's private link.

export const metadata: Metadata = { title: "Your contract", robots: { index: false } };

export default async function InvoiceContractPage({ params, searchParams }: PageProps<"/i/[token]/contract">) {
  const { token } = await params;
  const { approved } = await searchParams;
  const found = await findClientInvoice(token);
  if (!found) notFound();
  const { invoice, name } = found;

  const signed = Boolean(invoice.signedAt && invoice.contractContent);
  const contract = signed ? { content: invoice.contractContent! } : await filledInvoiceContract(invoice);
  if (!contract) redirect(`/i/${token}`);
  const canSign = !signed && canPay(invoice.kind, invoice.status);
  const logoUrl = found.logoKey ? await signedViewUrl(found.logoKey) : null;
  const signedAt = invoice.signedAt?.toLocaleString("en-US", { timeZone: found.timeZone, dateStyle: "long", timeStyle: "short" });

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
        <div className="print:hidden">
          {approved === "1" && canSign && (
            <p className="mb-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
              Your quote is approved! Next, please read and sign your contract with {name}.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/i/${token}`} className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
              ← Your {invoice.kind}
            </Link>
            {signed && <PrintButton />}
          </div>
        </div>

        <article className="card mt-4 p-6 sm:p-10 print:border-0 print:p-0 print:shadow-none">
          {/* Sanitized when filled in (lib/invoices/server.ts). */}
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: contract.content }} />

          {signed && (
            <div className="mt-10 border-t border-border pt-6">
              <p className="text-sm font-semibold text-muted">Signed by</p>
              {invoice.signatureType === "draw" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={invoice.signatureData!} alt={`Signature of ${invoice.signerName}`} className="mt-2 h-20 w-auto" />
              ) : (
                <p className={`${signatureFont.className} mt-2 text-4xl text-brand-deep`}>{invoice.signatureData}</p>
              )}
              <p className="mt-2 font-semibold">{invoice.signerName}</p>
              <p className="text-sm text-muted">
                Signed electronically {signedAt}
                {invoice.signerIp ? ` · IP ${invoice.signerIp}` : ""}
              </p>
            </div>
          )}
        </article>

        {canSign && (
          <section className="card mt-6 p-6 sm:p-8 print:hidden">
            <h2 className="font-display text-2xl font-bold">Sign your contract</h2>
            <div className="mt-5">
              <SignForm token={token} defaultName={invoice.clientName} sign={signInvoiceContract.bind(null, token)} />
            </div>
          </section>
        )}
        {!signed && !canSign && invoice.kind === "quote" && invoice.status === "sent" && (
          <p className="mt-6 rounded-2xl bg-sun/30 px-5 py-4 font-medium print:hidden">
            This is a preview. You&apos;ll sign it after approving the quote.
          </p>
        )}
      </main>

      <div className="print:hidden">
        <StudioFooter studioId={invoice.photographerId} />
      </div>
    </div>
  );
}
