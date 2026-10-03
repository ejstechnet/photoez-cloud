import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { findClientInvoice } from "@/lib/invoices/server";
import { applyCheckoutSession } from "@/lib/payments/checkout";
import { stripe } from "@/lib/stripe";

// Where Stripe Checkout sends the client back. The payment is checked with
// Stripe directly (the webhook may not have arrived yet), then they see
// their quote or invoice with what's left to pay.
export async function GET(request: Request, { params }: RouteContext<"/i/[token]/pay/return">) {
  const { token } = await params;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const cancelled = url.searchParams.get("cancelled") === "1";

  const found = await findClientInvoice(token);
  if (!found) return new Response("Not found", { status: 404 });
  const [payment] = await db.select().from(payments).where(eq(payments.stripeCheckoutSessionId, sessionId));
  if (!payment || payment.invoiceId !== found.invoice.id) redirect(`/i/${token}`);

  const session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeContext: payment.stripeAccountId });
  await applyCheckoutSession(session);
  if (session.payment_status === "paid") redirect(`/i/${token}?changed=paid`);

  // Backed out: close the checkout so it can't be paid later.
  if (cancelled && session.status === "open") {
    await stripe().checkout.sessions.expire(sessionId, {}, { stripeContext: payment.stripeAccountId });
    await db.update(payments).set({ status: "expired" }).where(eq(payments.id, payment.id));
  }
  redirect(`/i/${token}`);
}
