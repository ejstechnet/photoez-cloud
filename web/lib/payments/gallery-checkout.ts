import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { siteUrl } from "@/lib/site";
import { stripe } from "@/lib/stripe";

// Stripe Checkout for a gallery's extra photo selections, on the photographer's
// own connected account. When Stripe confirms the payment, the gallery's
// selections are submitted as paid (applyCheckoutSession).
export async function startGalleryCheckout(options: {
  galleryId: string;
  token: string;
  title: string;
  studioName: string;
  account: string;
  count: number;
  priceCents: number;
}) {
  const amount = options.count * options.priceCents;
  const base = `${siteUrl}/g/${options.token}/pay`;
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: options.count,
          price_data: {
            currency: "usd",
            unit_amount: options.priceCents,
            product_data: {
              name: "Additional photo",
              description: `${options.title} · ${options.studioName}`,
            },
          },
        },
      ],
      metadata: { galleryId: options.galleryId, kind: "gallery_extras" },
      payment_intent_data: { metadata: { galleryId: options.galleryId, kind: "gallery_extras" } },
      success_url: `${base}/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/return?session_id={CHECKOUT_SESSION_ID}&cancelled=1`,
    },
    { stripeContext: options.account },
  );
  await db.insert(payments).values({
    galleryId: options.galleryId,
    kind: "gallery_extras",
    quantity: options.count,
    amountCents: amount,
    stripeAccountId: options.account,
    stripeCheckoutSessionId: session.id,
  });
  return session.url;
}

// Extra photos a gallery's client has already paid for (e.g. before the
// photographer reopened proofing), so they're never charged twice.
export async function paidGalleryExtras(galleryId: string) {
  const rows = await db
    .select({ quantity: payments.quantity, amountCents: payments.amountCents })
    .from(payments)
    .where(and(eq(payments.galleryId, galleryId), eq(payments.status, "paid")));
  return {
    count: rows.reduce((sum, r) => sum + (r.quantity ?? 0), 0),
    cents: rows.reduce((sum, r) => sum + r.amountCents, 0),
  };
}
