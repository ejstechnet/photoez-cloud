import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { findClientBooking } from "@/lib/booking/client-booking";
import { contractTemplateFor, signedContractFor } from "@/lib/contracts/for-booking";
import { applyCheckoutSession, releaseHold } from "@/lib/payments/checkout";
import { stripe } from "@/lib/stripe";

// Where Stripe Checkout sends the client back. The payment is checked with
// Stripe directly (the webhook may not have arrived yet), then the client
// continues: paid deposit → contract (or their booking); backed out of the
// deposit → the time is released and they can pick again.
export async function GET(request: Request, { params }: RouteContext<"/booking/[token]/pay/return">) {
  const { token } = await params;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const cancelled = url.searchParams.get("cancelled") === "1";

  const found = await findClientBooking(token);
  if (!found) return new Response("Not found", { status: 404 });
  const { booking } = found;

  const [payment] = await db.select().from(payments).where(eq(payments.stripeCheckoutSessionId, sessionId));
  if (!payment || payment.bookingId !== booking.id) redirect(`/booking/${token}`);

  const session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeContext: payment.stripeAccountId });
  await applyCheckoutSession(session);

  if (session.payment_status === "paid") {
    if (payment.kind === "balance") redirect(`/booking/${token}?changed=paid`);
    const needsContract = !(await signedContractFor(booking.id)) && (await contractTemplateFor(booking)) !== null;
    redirect(needsContract ? `/booking/${token}/contract?new=1` : `/booking/${token}?new=1`);
  }

  if (cancelled && payment.kind === "deposit") {
    // Close the checkout so it can't be paid later, and free the time now.
    if (session.status === "open") {
      await stripe().checkout.sessions.expire(sessionId, {}, { stripeContext: payment.stripeAccountId });
    }
    await db.update(payments).set({ status: "expired" }).where(eq(payments.id, payment.id));
    await releaseHold(booking.id);
    redirect(found.slug ? `/studio/${found.slug}/book?payment=cancelled` : `/booking/${token}`);
  }
  redirect(`/booking/${token}`);
}
