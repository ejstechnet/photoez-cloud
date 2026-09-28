import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";
import { db } from "@/db";
import { galleries, payments, photographers, photos, storeOrderItems, storeOrders, storeProducts } from "@/db/schema";
import { paymentAccount } from "@/lib/payments/checkout";
import { siteUrl } from "@/lib/site";
import { signedViewUrl } from "@/lib/storage";
import { stripe } from "@/lib/stripe";
import { MAX_CART_LINES, MAX_QUANTITY, cartTotals, cropFits, orderNumber, variantRatio } from "./rules";

// The Online Store's checkout (decided with Elle 2026-09-28): clients order
// prints and products of their photos from their delivered gallery, and pay
// the studio through its own Stripe account. Shipping is collected by
// Stripe Checkout; the order becomes "paid" only when Stripe says so
// (markStoreOrderPaid, from the webhook or the client's return).

// What a delivered gallery's shop offers, or null when the studio's store
// is off or it can't take payments.
export async function storefrontFor(photographerId: string) {
  const [studio] = await db
    .select({
      enabled: photographers.storeEnabled,
      shippingCents: photographers.storeShippingCents,
      handlingCents: photographers.storeHandlingCents,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio?.enabled || !(await paymentAccount(photographerId))) return null;
  const products = await db
    .select({
      id: storeProducts.id,
      name: storeProducts.name,
      description: storeProducts.description,
      variants: storeProducts.variants,
      imageKeys: storeProducts.imageKeys,
    })
    .from(storeProducts)
    .where(and(eq(storeProducts.photographerId, photographerId), eq(storeProducts.active, true)))
    .orderBy(asc(storeProducts.sortOrder), asc(storeProducts.createdAt));
  const shown = await Promise.all(
    products
      .filter((p) => p.variants.length > 0)
      .map(async ({ imageKeys, ...p }) => ({ ...p, imageUrls: await Promise.all(imageKeys.map((key) => signedViewUrl(key))) })),
  );
  if (shown.length === 0) return null;
  return { products: shown, shippingCents: studio.shippingCents, handlingCents: studio.handlingCents };
}

export type Storefront = NonNullable<Awaited<ReturnType<typeof storefrontFor>>>;

const cropSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite(),
});

export const cartSchema = z
  .array(
    z.object({
      productId: z.uuid(),
      variantId: z.string().min(1).max(40),
      photoId: z.uuid(),
      quantity: z.number().int().min(1).max(MAX_QUANTITY),
      crop: cropSchema.nullable(),
    }),
  )
  .min(1, "Your cart is empty.")
  .max(MAX_CART_LINES, "That's a lot of items! Please split it into two orders.");

export type CartLine = z.infer<typeof cartSchema>[number];

// Checks the cart against the studio's real products and the gallery's
// finals, prices it here (never trusting the browser), and opens Stripe
// Checkout. Returns the Checkout page's address.
export async function startStoreCheckout(options: {
  galleryId: string;
  token: string;
  photographerId: string;
  studioName: string;
  clientName: string | null;
  clientEmail: string | null;
  cart: unknown;
}): Promise<{ url: string } | { error: string }> {
  const parsed = cartSchema.safeParse(options.cart);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Your cart couldn't be read. Please try again." };
  const store = await storefrontFor(options.photographerId);
  const account = await paymentAccount(options.photographerId);
  if (!store || !account) return { error: "This studio's shop is closed right now." };

  const photoIds = [...new Set(parsed.data.map((l) => l.photoId))];
  const finals = await db
    .select({ id: photos.id, width: photos.width, height: photos.height, name: photos.originalName })
    .from(photos)
    .where(and(eq(photos.galleryId, options.galleryId), eq(photos.kind, "final"), inArray(photos.id, photoIds)));

  const lines = [];
  for (const line of parsed.data) {
    const product = store.products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    const photo = finals.find((p) => p.id === line.photoId);
    if (!product || !variant || !photo) return { error: "Something in your cart isn't available anymore. Please remove it and try again." };
    const ratio = variantRatio(variant);
    if (ratio !== null) {
      if (!line.crop || !photo.width || !photo.height || !cropFits(line.crop, { width: photo.width, height: photo.height }, ratio)) {
        return { error: `Please crop photo "${photo.name}" again for the ${variant.label} size.` };
      }
    }
    lines.push({ product, variant, photo, quantity: line.quantity, crop: ratio !== null ? line.crop : null });
  }
  const totals = cartTotals(
    lines.map((l) => ({ unitCents: l.variant.priceCents, quantity: l.quantity })),
    store,
  );

  const [order] = await db
    .insert(storeOrders)
    .values({
      photographerId: options.photographerId,
      galleryId: options.galleryId,
      orderNumber: orderNumber(randomBytes(6)),
      clientName: options.clientName,
      clientEmail: options.clientEmail,
      ...totals,
    })
    .returning({ id: storeOrders.id, orderNumber: storeOrders.orderNumber });
  await db.insert(storeOrderItems).values(
    lines.map((l) => ({
      orderId: order.id,
      productId: l.product.id,
      photoId: l.photo.id,
      productName: l.product.name,
      variantLabel: l.variant.label,
      unitCents: l.variant.priceCents,
      quantity: l.quantity,
      crop: l.crop,
      photoName: l.photo.name,
    })),
  );

  const base = `${siteUrl}/g/${options.token}/shop/return`;
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      ...(options.clientEmail ? { customer_email: options.clientEmail } : {}),
      line_items: [
        ...lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: "usd",
            unit_amount: l.variant.priceCents,
            product_data: { name: `${l.product.name} · ${l.variant.label}`, description: `Photo: ${l.photo.name}` },
          },
        })),
        ...(totals.handlingCents > 0
          ? [
              {
                quantity: 1,
                price_data: { currency: "usd", unit_amount: totals.handlingCents, product_data: { name: "Handling" } },
              },
            ]
          : []),
      ],
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: totals.shippingCents > 0 ? "Shipping" : "Free shipping",
            fixed_amount: { amount: totals.shippingCents, currency: "usd" },
          },
        },
      ],
      metadata: { storeOrderId: order.id, kind: "store_order" },
      payment_intent_data: {
        description: `${options.studioName} order ${order.orderNumber}`,
        metadata: { storeOrderId: order.id, kind: "store_order" },
      },
      success_url: `${base}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}?session_id={CHECKOUT_SESSION_ID}&cancelled=1`,
    },
    { stripeContext: account },
  );
  await db.insert(payments).values({
    storeOrderId: order.id,
    kind: "store_order",
    amountCents: totals.totalCents,
    stripeAccountId: account,
    stripeCheckoutSessionId: session.id,
  });
  if (!session.url) return { error: "Online payment isn't available right now. Please try again in a minute." };
  return { url: session.url };
}

// Stripe confirmed the payment: the order is paid, with the address the
// client gave at checkout. Returns true only the first time.
export async function markStoreOrderPaid(orderId: string, session: Stripe.Checkout.Session) {
  const ship = session.collected_information?.shipping_details;
  const updated = await db
    .update(storeOrders)
    .set({
      status: "paid",
      paidAt: new Date(),
      clientEmail: session.customer_details?.email ?? undefined,
      clientName: session.customer_details?.name ?? undefined,
      shipName: ship?.name ?? null,
      shipLine1: ship?.address.line1 ?? null,
      shipLine2: ship?.address.line2 ?? null,
      shipCity: ship?.address.city ?? null,
      shipState: ship?.address.state ?? null,
      shipPostalCode: ship?.address.postal_code ?? null,
      shipCountry: ship?.address.country ?? null,
    })
    .where(and(eq(storeOrders.id, orderId), eq(storeOrders.status, "pending_payment")))
    .returning({ id: storeOrders.id });
  return updated.length > 0;
}

// An abandoned checkout: the order never happened.
export async function cancelUnpaidStoreOrder(orderId: string) {
  await db
    .update(storeOrders)
    .set({ status: "cancelled" })
    .where(and(eq(storeOrders.id, orderId), eq(storeOrders.status, "pending_payment")));
}

// The gallery a store order came from, for the return page.
export async function storeOrderGallery(orderId: string) {
  const [row] = await db
    .select({ token: galleries.shareToken, orderNumber: storeOrders.orderNumber })
    .from(storeOrders)
    .innerJoin(galleries, eq(galleries.id, storeOrders.galleryId))
    .where(eq(storeOrders.id, orderId));
  return row ?? null;
}
