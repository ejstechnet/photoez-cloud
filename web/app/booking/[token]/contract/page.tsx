import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findClientBooking } from "@/lib/booking/client-booking";
import { contractTemplateFor, filledContract, signedContractFor } from "@/lib/contracts/for-booking";
import { signedViewUrl } from "@/lib/storage";
import { StudioBar, StudioFooter } from "@/app/studio/[slug]/studio-bar";
import { PrintButton } from "./print-button";
import { SignForm } from "./sign-form";
import { signatureFont } from "./signature-font";

// The contract for a booking: to sign (right after booking), or the signed
// copy to view and print, forever, from the client's private link.

export const metadata: Metadata = { title: "Your contract", robots: { index: false } };

export default async function ContractPage({ params, searchParams }: PageProps<"/booking/[token]/contract">) {
  const { token } = await params;
  const { new: isNew, signed: justSigned } = await searchParams;
  const row = await findClientBooking(token);
  if (!row) notFound();
  const { booking, name } = row;

  const signed = await signedContractFor(booking.id);
  const template = signed ? null : await contractTemplateFor(booking);
  if (!signed && (!template || booking.status === "cancelled")) redirect(`/booking/${token}`);
  const content = signed ? signed.content : await filledContract(booking, template!);
  const logoUrl = row.logoKey ? await signedViewUrl(row.logoKey) : null;
  const signedAt = signed?.signedAt.toLocaleString("en-US", {
    timeZone: row.timeZone,
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="print:hidden">
        {row.slug ? (
          <StudioBar slug={row.slug} name={name} logoUrl={logoUrl} logoBg={row.logoBg} />
        ) : (
          <div className="bg-brand-deep px-4 py-4 font-display text-lg text-white">{name}</div>
        )}
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 print:py-0">
        <div className="print:hidden">
          {isNew === "1" && !signed && (
            <p className="mb-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
              You&apos;re booked! One last step: please read and sign your contract with {name}.
            </p>
          )}
          {justSigned === "1" && signed && (
            <p className="mb-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
              Thank you! Your contract is signed. You can view or print it here any time.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/booking/${token}`}
              className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
            >
              ← Your booking
            </Link>
            {signed && <PrintButton />}
          </div>
        </div>

        <article className="card mt-4 p-6 sm:p-10 print:border-0 print:p-0 print:shadow-none">
          {/* Sanitized when filled in (lib/contracts/for-booking.ts). */}
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: content }} />

          {signed && (
            <div className="mt-10 border-t border-border pt-6">
              <p className="text-sm font-semibold text-muted">Signed by</p>
              {signed.signatureType === "draw" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signed.signatureData} alt={`Signature of ${signed.signerName}`} className="mt-2 h-20 w-auto" />
              ) : (
                <p className={`${signatureFont.className} mt-2 text-4xl text-brand-deep`}>{signed.signatureData}</p>
              )}
              <p className="mt-2 font-semibold">{signed.signerName}</p>
              <p className="text-sm text-muted">
                Signed electronically {signedAt}
                {signed.clientIp ? ` · IP ${signed.clientIp}` : ""}
              </p>
            </div>
          )}
        </article>

        {!signed && (
          <section className="card mt-6 p-6 sm:p-8 print:hidden">
            <h2 className="font-display text-2xl font-bold">Sign your contract</h2>
            <div className="mt-5">
              <SignForm token={token} defaultName={booking.clientName} />
            </div>
          </section>
        )}
      </main>

      <div className="print:hidden">
        <StudioFooter />
      </div>
    </div>
  );
}
