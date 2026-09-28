// The Online Store's rules as plain functions: product sizes, prices, crop
// shapes, and cart totals. The cart is priced again on the server from these
// same rules, so the browser's numbers are only ever a preview.
// Tested in rules.test.ts.

import type { StoreCrop, StoreVariant } from "../../db/schema.ts";

export const MAX_VARIANTS = 12;
export const MAX_QUANTITY = 25;
export const MAX_CART_LINES = 40;
// Pictures of each product shown in the shop.
export const MAX_PRODUCT_PHOTOS = 6;

// Ready-made print sizes for "Add starter prints".
export const STARTER_PRINTS: Omit<StoreVariant, "id">[] = [
  { label: "4×6", priceCents: 1500, widthIn: 4, heightIn: 6 },
  { label: "5×7", priceCents: 2000, widthIn: 5, heightIn: 7 },
  { label: "8×10", priceCents: 3000, widthIn: 8, heightIn: 10 },
  { label: "11×14", priceCents: 4500, widthIn: 11, heightIn: 14 },
  { label: "16×20", priceCents: 7500, widthIn: 16, heightIn: 20 },
];

// "$25" / "25.50" → 2550; null when it isn't a price from $0.50 to $10,000.
export function parsePrice(value: string) {
  const dollars = Number(value.trim().replace(/^\$/, ""));
  if (!Number.isFinite(dollars) || dollars < 0.5 || dollars > 10000) return null;
  return Math.round(dollars * 100);
}

// A size's crop shape as width ÷ height (always ≥ 1, so it fits either way
// round), or null for products that aren't cropped.
export function variantRatio(variant: Pick<StoreVariant, "widthIn" | "heightIn">) {
  if (!variant.widthIn || !variant.heightIn) return null;
  return Math.max(variant.widthIn, variant.heightIn) / Math.min(variant.widthIn, variant.heightIn);
}

// Whether a crop (fractions of the photo) has the size's shape on this
// photo, in either orientation, within 2%.
export function cropFits(crop: StoreCrop, photo: { width: number; height: number }, ratio: number) {
  const inside =
    crop.x >= -0.001 &&
    crop.y >= -0.001 &&
    crop.width > 0.01 &&
    crop.height > 0.01 &&
    crop.x + crop.width <= 1.001 &&
    crop.y + crop.height <= 1.001;
  if (!inside) return false;
  const w = crop.width * photo.width;
  const h = crop.height * photo.height;
  const shape = Math.max(w, h) / Math.min(w, h);
  return Math.abs(shape - ratio) / ratio <= 0.02;
}

// The biggest centered crop of the size's shape, matching the photo's
// orientation: the starting point before the client adjusts it.
export function centeredCrop(photo: { width: number; height: number }, ratio: number): StoreCrop {
  const portrait = photo.height > photo.width;
  const want = portrait ? 1 / ratio : ratio; // width ÷ height of the crop
  const photoShape = photo.width / photo.height;
  if (photoShape > want) {
    const width = want / photoShape;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = photoShape / want;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

// The crop in pixels on the original file, for making the print file.
export function cropPixels(crop: StoreCrop, photo: { width: number; height: number }) {
  const left = Math.max(0, Math.round(crop.x * photo.width));
  const top = Math.max(0, Math.round(crop.y * photo.height));
  const width = Math.min(photo.width - left, Math.round(crop.width * photo.width));
  const height = Math.min(photo.height - top, Math.round(crop.height * photo.height));
  return { left, top, width, height };
}

export type PricedLine = { unitCents: number; quantity: number };

// Totals for a cart: shipping and handling are once per order.
export function cartTotals(lines: PricedLine[], settings: { shippingCents: number; handlingCents: number }) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
  const shippingCents = lines.length > 0 ? settings.shippingCents : 0;
  const handlingCents = lines.length > 0 ? settings.handlingCents : 0;
  return { subtotalCents, shippingCents, handlingCents, totalCents: subtotalCents + shippingCents + handlingCents };
}

const ORDER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// "PEZ-4K7Q2M": short enough to read over the phone.
export function orderNumber(random: Uint8Array) {
  return `PEZ-${Array.from(random.slice(0, 6), (b) => ORDER_ALPHABET[b % ORDER_ALPHABET.length]).join("")}`;
}

// A link to the carrier's tracking page, when the carrier is one we know.
export function trackingUrl(carrier: string | null, tracking: string | null) {
  if (!tracking) return null;
  const n = encodeURIComponent(tracking.trim());
  switch ((carrier ?? "").toLowerCase()) {
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${n}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "dhl":
      return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}`;
    default:
      return null;
  }
}
