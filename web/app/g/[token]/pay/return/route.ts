import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { findGalleryByToken } from "@/lib/client-gallery";
import { applyCheckoutSession } from "@/lib/payments/checkout";
import { stripe } from "@/lib/stripe";

// Where Stripe Checkout sends a client back after paying for extra photos.
// The payment is checked with Stripe directly (the webhook may not have
// arrived yet); paid means their selections are submitted.
export async function GET(request: Request, { params }: RouteContext<"/g/[token]/pay/return">) {
  const { token } = await params;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id") ?? "";
  const cancelled = url.searchParams.get("cancelled") === "1";

  const gallery = await findGalleryByToken(token);
  if (!gallery) return new Response("Not found", { status: 404 });

  const [payment] = await db.select().from(payments).where(eq(payments.stripeCheckoutSessionId, sessionId));
  if (!payment || payment.galleryId !== gallery.id) redirect(`/g/${token}`);

  const session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeContext: payment.stripeAccountId });
  await applyCheckoutSession(session);

  if (session.payment_status === "paid") {
    revalidatePath(`/dashboard/galleries/${gallery.id}`);
    redirect(`/g/${token}?paid=1`);
  }
  if (cancelled && session.status === "open") {
    // Close the unpaid checkout; their picks stay so they can adjust and try again.
    await stripe().checkout.sessions.expire(sessionId, {}, { stripeContext: payment.stripeAccountId });
    await db.update(payments).set({ status: "expired" }).where(eq(payments.id, payment.id));
  }
  redirect(`/g/${token}${cancelled ? "?payment=cancelled" : ""}`);
}
