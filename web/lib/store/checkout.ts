import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";
import { db } from "@/db";
import {
  galleries,
  payments,
  photographers,
  photos,
  storeOrderItems,
  storeOrders,
  storeProducts,
  storeShippingQuotes,
  type StoreShipTo,
} from "@/db/schema";
import { paymentAccount } from "@/lib/payments/checkout";
import { siteUrl } from "@/lib/site";
import { signedViewUrl } from "@/lib/storage";
import { stripe } from "@/lib/stripe";
import { swaggKeyFor } from "@/lib/swaggpress/catalog";
import { swaggRates } from "@/lib/swaggpress/client";
import { sellable } from "@/lib/swaggpress/mapping";
import { galleryDesign } from "./designs";
import { MAX_CART_LINES, MAX_QUANTITY, cartTotals, checkFields, cropFits, itemUnitCents, optionsCents, orderNumber, variantRatio } from "./rules";

// The Online Store's checkout (decided with Elle 2026-09-28): clients order
// prints and products of their photos from their delivered gallery, and pay
// the studio through its own Stripe account. The order becomes "paid" only
// when Stripe says so (markStoreOrderPaid, from the webhook or the return).
//
// Two kinds of items can share a cart:
// - the studio's own ("self"): Stripe collects the address, and the studio's
//   flat shipping applies;
// - SwaggPress items: the client enters the address in the cart first, picks
//   a live shipping rate (quoteStoreShipping), and after payment the order is
//   sent to SwaggPress automatically (lib/swaggpress/orders.ts).

// What a delivered gallery's shop offers, or null when the studio's store
// is off or it can't take payments. SwaggPress products show only while the
// studio is connected with a card on file, and only sizes still sellable.
export async function storefrontFor(photographerId: string) {
  const [studio] = await db
    .select({
      enabled: photographers.storeEnabled,
      shippingCents: photographers.storeShippingCents,
      handlingCents: photographers.storeHandlingCents,
      swaggConnected: photographers.swaggpressKey,
      swaggCard: photographers.swaggpressCardOnFile,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio?.enabled || !(await paymentAccount(photographerId))) return null;
  const swaggReady = Boolean(studio.swaggConnected) && studio.swaggCard;
  const products = await db
    .select({
      id: storeProducts.id,
      name: storeProducts.name,
      description: storeProducts.description,
      variants: storeProducts.variants,
      imageKeys: storeProducts.imageKeys,
      fulfillment: storeProducts.fulfillment,
      labProductId: storeProducts.labProductId,
      labImageUrls: storeProducts.labImageUrls,
      labUnavailable: storeProducts.labUnavailable,
      labDesign: storeProducts.labDesign,
      labOptions: storeProducts.labOptions,
      labMode: storeProducts.labMode,
      labFields: storeProducts.labFields,
    })
    .from(storeProducts)
    .where(and(eq(storeProducts.photographerId, photographerId), eq(storeProducts.active, true)))
    .orderBy(asc(storeProducts.sortOrder), asc(storeProducts.createdAt));
  const shown = await Promise.all(
    products
      .filter((p) => p.fulfillment === "self" || (swaggReady && !p.labUnavailable))
      .map((p) => ({ ...p, variants: p.variants.filter(sellable) }))
      .filter((p) => p.variants.length > 0)
      .map(async (p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        variants: p.variants,
        fulfillment: p.fulfillment,
        labProductId: p.labProductId,
        // Designed in the gallery designer (SwaggPress products with a design setup).
        // Only products SwaggPress sells through its designer are designed.
        design: p.fulfillment === "swaggpress" && (p.labMode ?? "custom_design") === "custom_design" ? p.labDesign : null,
        // Custom Text & Photos products: the fields to fill in instead.
        fields: p.fulfillment === "swaggpress" && p.labMode === "custom_text" ? (p.labFields ?? []) : [],
        // Options besides size (SwaggPress products), e.g. Trim.
        options: p.fulfillment === "swaggpress" ? (p.labOptions ?? []) : [],
        imageUrls: p.fulfillment === "swaggpress" ? p.labImageUrls : await Promise.all(p.imageKeys.map((key) => signedViewUrl(key))),
      })),
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
      // A gallery designer design (lib/store/designs.ts).
      designId: z.uuid().nullable().optional(),
      // The client's option picks, e.g. { Trim: "With trim" }.
      options: z.record(z.string().max(60), z.string().max(80)).optional(),
      // Custom Text & Photos products: answers by field key, and gallery photos for photo fields.
      fields: z.record(z.string().max(40), z.string().max(500)).optional(),
      fieldPhotos: z.record(z.string().max(40), z.array(z.uuid()).max(10)).optional(),
    }),
  )
  .min(1, "Your cart is empty.")
  .max(MAX_CART_LINES, "That's a lot of items! Please split it into two orders.");

export type CartLine = z.infer<typeof cartSchema>[number];

export const shipToSchema = z.object({
  name: z.string().trim().min(2, "Enter the name to ship to.").max(120),
  line1: z.string().trim().min(3, "Enter the street address.").max(200),
  line2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use the 2-letter state, like OR."),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code."),
  phone: z.string().trim().max(30).default(""),
});

// The cart checked against the studio's real products and the gallery's
// finals (never trusting the browser's prices).
async function checkCart(galleryId: string, photographerId: string, cart: unknown) {
  const parsed = cartSchema.safeParse(cart);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Your cart couldn't be read. Please try again." };
  const store = await storefrontFor(photographerId);
  if (!store) return { error: "This studio's shop is closed right now." };
  const photoIds = [...new Set(parsed.data.flatMap((l) => [l.photoId, ...Object.values(l.fieldPhotos ?? {}).flat()]))];
  const finals = await db
    .select({ id: photos.id, width: photos.width, height: photos.height, name: photos.originalName })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, "final"), inArray(photos.id, photoIds)));
  const lines = [];
  for (const line of parsed.data) {
    const product = store.products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    const photo = finals.find((p) => p.id === line.photoId);
    if (!product || !variant || !photo) return { error: "Something in your cart isn't available anymore. Please remove it and try again." };
    const picked = optionsCents(product.options, line.options);
    if ("error" in picked) return { error: `${product.name}: ${picked.error}` };
    const filled = checkFields(product.fields, picked.picks, line.fields, line.fieldPhotos);
    if ("error" in filled) return { error: `${product.name}: ${filled.error}` };
    if (filled.photoIds.some((id) => !finals.some((f) => f.id === id))) {
      return { error: `${product.name}: a photo you chose isn't in this gallery anymore. Please choose again.` };
    }
    const personalized = { fields: filled.text, fieldPhotoIds: filled.photoIds };
    // Designed products: the design replaces cropping.
    if (product.design) {
      const design = line.designId ? await galleryDesign(galleryId, line.designId) : null;
      if (!design || design.productId !== product.id) {
        return { error: `Please design your ${product.name} again, then add it to your cart.` };
      }
      // The client's full-wrap choice comes from the saved design, never the browser.
      const wrap = (design.design as { printStyle?: string }).printStyle === "wrap" && Boolean(product.design.wrapChoice);
      lines.push({
        product,
        variant,
        photo,
        quantity: line.quantity,
        crop: null,
        designId: design.id,
        wrap,
        options: picked.picks,
        ...personalized,
        unitCents: itemUnitCents(variant, product.design, wrap, picked.cents),
      });
      continue;
    }
    const ratio = variantRatio(variant);
    if (ratio !== null) {
      if (!line.crop || !photo.width || !photo.height || !cropFits(line.crop, { width: photo.width, height: photo.height }, ratio)) {
        return { error: `Please crop photo "${photo.name}" again for the ${variant.label} size.` };
      }
    }
    lines.push({
      product,
      variant,
      photo,
      quantity: line.quantity,
      crop: ratio !== null ? line.crop : null,
      designId: null as string | null,
      wrap: false,
      options: picked.picks,
      ...personalized,
      unitCents: variant.priceCents + picked.cents,
    });
  }
  return { store, lines };
}

type CheckedLine = Extract<Awaited<ReturnType<typeof checkCart>>, { lines: unknown }>["lines"][number];

// "12:2,15:1": which SwaggPress sizes and how many, so a changed cart needs
// a fresh shipping quote.
function labItemsKey(lines: CheckedLine[]) {
  const counts = new Map<string, number>();
  for (const l of lines) {
    if (l.product.fulfillment !== "swaggpress") continue;
    const key = String(l.variant.labVariantId ?? `p${l.product.labProductId}`);
    counts.set(key, (counts.get(key) ?? 0) + l.quantity);
  }
  return [...counts].sort().map(([k, n]) => `${k}:${n}`).join(",");
}

function labItems(lines: CheckedLine[]) {
  return lines
    .filter((l) => l.product.fulfillment === "swaggpress")
    .map((l) =>
      l.variant.labVariantId ? { variant_id: l.variant.labVariantId, qty: l.quantity } : { product_id: l.product.labProductId!, qty: l.quantity },
    );
}

// Shipping options for a cart's SwaggPress items to an address: live rates
// from SwaggPress, saved so checkout charges exactly what was shown.
export async function quoteStoreShipping(options: {
  galleryId: string;
  photographerId: string;
  cart: unknown;
  shipTo: unknown;
}): Promise<{ quoteId: string; rates: { id: string; label: string; amountCents: number; days: number | null }[] } | { error: string }> {
  const checked = await checkCart(options.galleryId, options.photographerId, options.cart);
  if ("error" in checked) return { error: checked.error! };
  const to = shipToSchema.safeParse(options.shipTo);
  if (!to.success) return { error: to.error.issues[0]?.message ?? "Please check the address." };
  const items = labItems(checked.lines);
  if (items.length === 0) return { error: "Nothing in your cart needs a shipping quote." };
  const key = await swaggKeyFor(options.photographerId);
  if (!key) return { error: "This studio's print partner isn't connected right now." };
  let rates;
  try {
    rates = await swaggRates(key, items, to.data);
  } catch (error) {
    return { error: (error as Error).message };
  }
  const quoted = rates.map((r) => ({ id: r.id, carrier: r.carrier, service: r.service, amountCents: Math.round(r.amount * 100), days: r.days }));
  const [quote] = await db
    .insert(storeShippingQuotes)
    .values({
      galleryId: options.galleryId,
      shipTo: to.data as StoreShipTo,
      rates: quoted,
      itemsKey: labItemsKey(checked.lines),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning({ id: storeShippingQuotes.id });
  return {
    quoteId: quote.id,
    rates: quoted.map((r) => ({ id: r.id, label: `${r.carrier} ${r.service}`.trim(), amountCents: r.amountCents, days: r.days })),
  };
}

// Prices the cart here and opens Stripe Checkout. Returns its address.
export async function startStoreCheckout(options: {
  galleryId: string;
  token: string;
  photographerId: string;
  studioName: string;
  clientName: string | null;
  clientEmail: string | null;
  cart: unknown;
  shipping?: { quoteId: string; rateId: string } | null;
}): Promise<{ url: string } | { error: string }> {
  const checked = await checkCart(options.galleryId, options.photographerId, options.cart);
  if ("error" in checked) return { error: checked.error! };
  const account = await paymentAccount(options.photographerId);
  if (!account) return { error: "This studio's shop is closed right now." };
  const { store, lines } = checked;
  const hasLab = lines.some((l) => l.product.fulfillment === "swaggpress");
  const hasSelf = lines.some((l) => l.product.fulfillment === "self");

  // SwaggPress items: the quote the client chose, still valid for this cart.
  let lab: { shipTo: StoreShipTo; rate: { id: string; carrier: string; service: string; amountCents: number } } | null = null;
  if (hasLab) {
    const quoteId = options.shipping?.quoteId ?? "";
    const [quote] = z.uuid().safeParse(quoteId).success
      ? await db
          .select()
          .from(storeShippingQuotes)
          .where(
            and(
              eq(storeShippingQuotes.id, quoteId),
              eq(storeShippingQuotes.galleryId, options.galleryId),
              gt(storeShippingQuotes.expiresAt, new Date()),
            ),
          )
      : [];
    const rate = quote?.rates.find((r) => r.id === options.shipping?.rateId);
    if (!quote || !rate || quote.itemsKey !== labItemsKey(lines)) {
      return { error: "Please choose a shipping option again. Your cart or address changed." };
    }
    lab = { shipTo: quote.shipTo, rate };
  }

  const totals = cartTotals(
    lines.map((l) => ({ unitCents: l.unitCents, quantity: l.quantity, fulfillment: l.product.fulfillment })),
    store,
    lab?.rate.amountCents ?? 0,
  );

  const [order] = await db
    .insert(storeOrders)
    .values({
      photographerId: options.photographerId,
      galleryId: options.galleryId,
      orderNumber: orderNumber(randomBytes(6)),
      clientName: options.clientName,
      clientEmail: options.clientEmail,
      subtotalCents: totals.subtotalCents,
      shippingCents: totals.shippingCents,
      handlingCents: totals.handlingCents,
      totalCents: totals.totalCents,
      ...(lab
        ? {
            shipName: lab.shipTo.name,
            shipLine1: lab.shipTo.line1,
            shipLine2: lab.shipTo.line2 || null,
            shipCity: lab.shipTo.city,
            shipState: lab.shipTo.state,
            shipPostalCode: lab.shipTo.zip,
            shipCountry: "US",
            labShippingCents: totals.labShippingCents,
            labShippingService: `${lab.rate.carrier} ${lab.rate.service}`.trim(),
            labRateId: lab.rate.id,
            labStatus: "pending" as const,
          }
        : {}),
    })
    .returning({ id: storeOrders.id, orderNumber: storeOrders.orderNumber });
  await db.insert(storeOrderItems).values(
    lines.map((l) => ({
      orderId: order.id,
      productId: l.product.id,
      photoId: l.photo.id,
      productName: l.product.name,
      variantLabel: l.wrap ? `${l.variant.label} · Full wrap` : l.variant.label,
      unitCents: l.unitCents,
      quantity: l.quantity,
      crop: l.crop,
      photoName: l.photo.name,
      fulfillment: l.product.fulfillment,
      labVariantId: l.variant.labVariantId ?? null,
      labProductId: l.product.labProductId ?? null,
      designId: l.designId,
      options: Object.keys(l.options).length ? l.options : null,
      fields: Object.keys(l.fields).length ? l.fields : null,
      fieldPhotoIds: l.fieldPhotoIds.length ? l.fieldPhotoIds : null,
    })),
  );

  const shippingName = [lab ? `${lab.rate.carrier} ${lab.rate.service}`.trim() : null, hasSelf && totals.selfShippingCents > 0 ? "studio shipping" : null]
    .filter(Boolean)
    .join(" + ");
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
            unit_amount: l.unitCents,
            product_data: {
              name: `${l.product.name} · ${l.variant.label}${l.wrap ? " · Full wrap" : ""}${Object.entries(l.options).map(([k, v]) => ` · ${k}: ${v}`).join("")}`, description: l.designId ? "Your design" : `Photo: ${l.photo.name}` },
          },
        })),
        ...(totals.handlingCents > 0
          ? [{ quantity: 1, price_data: { currency: "usd", unit_amount: totals.handlingCents, product_data: { name: "Handling" } } }]
          : []),
      ],
      // The address was already given for SwaggPress items; otherwise Stripe asks.
      ...(lab ? {} : { shipping_address_collection: { allowed_countries: ["US" as const] } }),
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: totals.shippingCents > 0 ? `Shipping${shippingName ? ` (${shippingName})` : ""}` : "Free shipping",
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

// Stripe confirmed the payment: the order is paid. The address comes from
// Checkout, unless the client gave it in the cart (SwaggPress items).
// Returns true only the first time.
export async function markStoreOrderPaid(orderId: string, session: Stripe.Checkout.Session) {
  const ship = session.collected_information?.shipping_details;
  const updated = await db
    .update(storeOrders)
    .set({
      status: "paid",
      paidAt: new Date(),
      clientEmail: session.customer_details?.email ?? undefined,
      clientName: session.customer_details?.name ?? undefined,
      ...(ship
        ? {
            shipName: ship.name ?? null,
            shipLine1: ship.address.line1 ?? null,
            shipLine2: ship.address.line2 ?? null,
            shipCity: ship.address.city ?? null,
            shipState: ship.address.state ?? null,
            shipPostalCode: ship.address.postal_code ?? null,
            shipCountry: ship.address.country ?? null,
          }
        : {}),
    })
    .where(and(eq(storeOrders.id, orderId), eq(storeOrders.status, "pending_payment")))
    .returning({ id: storeOrders.id });
  return updated.length > 0;
}

// An abandoned checkout: the order never happened.
export async function cancelUnpaidStoreOrder(orderId: string) {
  await db
    .update(storeOrders)
    .set({ status: "cancelled", labStatus: "none" })
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
