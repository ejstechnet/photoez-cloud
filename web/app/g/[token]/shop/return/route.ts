import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { payments, storeOrders } from "@/db/schema";
import { findGalleryByToken } from "@/lib/client-gallery";
import { applyCheckoutSession } from "@/lib/payments/checkout";
import { stripe } from "@/lib/stripe";

// Where Stripe Checkout sends a client back after paying for a store order.
// The payment is checked with Stripe directly (the webhook may not have
// arrived yet); paid shows the thank-you with the order number.
export async function GET(request: Request, { params }: RouteContext<"/g/[token]/shop/return">) {
  const { token } = await params;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const cancelled = url.searchParams.get("cancelled") === "1";

  const gallery = await findGalleryByToken(token);
  if (!gallery) return new Response("Not found", { status: 404 });
  const [payment] = await db.select().from(payments).where(eq(payments.stripeCheckoutSessionId, sessionId));
  const [order] = payment?.storeOrderId
    ? await db.select().from(storeOrders).where(eq(storeOrders.id, payment.storeOrderId))
    : [];
  if (!payment || !order || order.galleryId !== gallery.id) redirect(`/g/${token}`);

  const session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeContext: payment.stripeAccountId });
  await applyCheckoutSession(session);
  if (session.payment_status === "paid") redirect(`/g/${token}?ordered=${order.orderNumber}`);
  if (cancelled && session.status === "open") {
    // Close the unpaid checkout; the cart stays so they can change it and try again.
    await stripe().checkout.sessions.expire(sessionId, {}, { stripeContext: payment.stripeAccountId });
    await applyCheckoutSession(
      await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeContext: payment.stripeAccountId }),
    );
  }
  redirect(`/g/${token}${cancelled ? "?order=cancelled" : ""}`);
}
