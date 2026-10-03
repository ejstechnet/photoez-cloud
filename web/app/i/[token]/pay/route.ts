import { redirect } from "next/navigation";
import { startInvoiceCheckout } from "@/lib/invoices/checkout";
import { findClientInvoice, needsSignature } from "@/lib/invoices/server";

// "Pay" from the client's quote or invoice page: opens Stripe Checkout for
// the next scheduled payment (?amount=next) or the whole balance (?amount=full).
export async function GET(request: Request, { params }: RouteContext<"/i/[token]/pay">) {
  const { token } = await params;
  const found = await findClientInvoice(token);
  if (!found) return new Response("Not found", { status: 404 });
  const { invoice } = found;
  // The contract comes first.
  if (needsSignature(invoice)) redirect(`/i/${token}/contract`);
  const which = new URL(request.url).searchParams.get("amount") === "full" ? "full" : "next";
  const url = await startInvoiceCheckout(invoice, found.name, which);
  redirect(url ?? `/i/${token}`);
}
