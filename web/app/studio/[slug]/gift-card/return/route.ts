import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { applyCheckoutSession } from "@/lib/payments/checkout";
import { stripe } from "@/lib/stripe";

// Where Stripe Checkout sends a gift card buyer back. The payment is checked
// with Stripe directly (the webhook may not have arrived yet); paid turns the
// card on and sends it (applyCheckoutSession).
export async function GET(request: Request, { params }: RouteContext<"/studio/[slug]/gift-card/return">) {
  const { slug } = await params;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const cancelled = url.searchParams.get("cancelled") === "1";
  const page = `/studio/${slug.toLowerCase()}/gift-card`;

  const [payment] = await db.select().from(payments).where(eq(payments.stripeCheckoutSessionId, sessionId));
  if (!payment?.giftCardId) redirect(page);

  const session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeContext: payment.stripeAccountId });
  if (cancelled && session.status === "open") {
    // Close the unpaid checkout so the card never becomes usable.
    await stripe().checkout.sessions.expire(sessionId, {}, { stripeContext: payment.stripeAccountId });
    const expired = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeContext: payment.stripeAccountId });
    await applyCheckoutSession(expired);
    redirect(`${page}?payment=cancelled`);
  }
  await applyCheckoutSession(session);
  redirect(session.payment_status === "paid" ? `${page}?bought=1` : page);
}
