"use server";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { afterResponse } from "@/lib/email/send";
import { canPay } from "@/lib/invoices/math";
import { emailInvoiceUpdate } from "@/lib/invoices/notify";
import { filledInvoiceContract, findClientInvoice, needsSignature } from "@/lib/invoices/server";
import { clientIp, overLimit } from "@/lib/rate-limit";

// What a client can do from their private quote / invoice link: approve or
// decline a quote, and sign the contract. The link's token is the only key,
// so every action checks the invoice's state again here.

export type ClientActionState = { message?: string };

const MAX_DRAWN_SIGNATURE = 300_000;
const tooMany = () => overLimit("invoice-client", 30, 10 * 60 * 1000);

export async function approveQuote(token: string): Promise<ClientActionState> {
  if (await tooMany()) return { message: "Too many tries. Please wait a few minutes." };
  const found = await findClientInvoice(token);
  if (!found) return { message: "This link isn't valid anymore." };
  const { invoice } = found;
  if (invoice.kind !== "quote" || invoice.status !== "sent") return { message: "This quote can't be approved anymore." };
  const [done] = await db
    .update(invoices)
    .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "sent")))
    .returning({ id: invoices.id });
  if (done) afterResponse(() => emailInvoiceUpdate(invoice.id, { type: "approved" }));
  revalidatePath("/dashboard", "layout");
  redirect(needsSignature(invoice) ? `/i/${token}/contract?approved=1` : `/i/${token}?approved=1`);
}

export async function declineQuote(token: string, reason: string): Promise<ClientActionState> {
  if (await tooMany()) return { message: "Too many tries. Please wait a few minutes." };
  const found = await findClientInvoice(token);
  if (!found) return { message: "This link isn't valid anymore." };
  const { invoice } = found;
  if (invoice.kind !== "quote" || invoice.status !== "sent") return { message: "This quote can't be declined anymore." };
  const note = reason.trim().slice(0, 1000) || null;
  const [done] = await db
    .update(invoices)
    .set({ status: "declined", declinedAt: new Date(), declineReason: note, updatedAt: new Date() })
    .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "sent")))
    .returning({ id: invoices.id });
  if (done) afterResponse(() => emailInvoiceUpdate(invoice.id, { type: "declined", reason: note }));
  revalidatePath("/dashboard", "layout");
  redirect(`/i/${token}`);
}

// Signing, the same way as a booking contract (drawn or typed). The
// contract text is filled in again here, never taken from the page.
export async function signInvoiceContract(
  token: string,
  input: { signerName: string; type: "draw" | "type"; data: string; agreed: boolean },
): Promise<ClientActionState> {
  if (await tooMany()) return { message: "Too many tries. Please wait a few minutes." };
  const found = await findClientInvoice(token);
  if (!found) return { message: "This link isn't valid anymore." };
  const { invoice } = found;
  if (invoice.signedAt) return { message: "This contract is already signed." };
  if (!canPay(invoice.kind, invoice.status)) {
    return { message: invoice.kind === "quote" && invoice.status === "sent" ? "Approve the quote first." : "This can't be signed anymore." };
  }

  const signerName = input.signerName.trim();
  if (signerName.length < 2 || signerName.length > 120) return { message: "Type your full legal name." };
  if (!input.agreed) return { message: "Tick the box to confirm you've read and agree to the contract." };
  if (input.type === "draw") {
    if (!input.data.startsWith("data:image/png;base64,") || input.data.length > MAX_DRAWN_SIGNATURE) {
      return { message: "Please draw your signature again." };
    }
  } else if (input.type !== "type") {
    return { message: "Please sign again." };
  }

  const contract = await filledInvoiceContract(invoice);
  if (!contract) return { message: "There's no contract to sign here." };
  const head = await headers();
  const [signed] = await db
    .update(invoices)
    .set({
      contractTitle: contract.title,
      contractContent: contract.content,
      signerName,
      signatureType: input.type,
      signatureData: input.type === "draw" ? input.data : signerName,
      signedAt: new Date(),
      signerIp: await clientIp(),
      signerUserAgent: head.get("user-agent")?.slice(0, 500) ?? null,
      updatedAt: new Date(),
    })
    // Two signings at once: only the first is kept.
    .where(and(eq(invoices.id, invoice.id), isNull(invoices.signedAt)))
    .returning({ id: invoices.id });
  if (!signed) return { message: "This contract is already signed." };

  afterResponse(() => emailInvoiceUpdate(invoice.id, { type: "signed", signerName }));
  revalidatePath("/dashboard", "layout");
  redirect(`/i/${token}?signed=1`);
}
