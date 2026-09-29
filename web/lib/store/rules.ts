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

export type PricedLine = { unitCents: number; quantity: number; fulfillment?: "self" | "swaggpress" };

// One item's price: the size's price, plus the full-wrap or all-over
// upcharge when the client chose that print style on a product that offers
// it, plus the chosen options' price changes (optionsCents). `style` true/false
// is the older "full wrap or not".
export function itemUnitCents(
  variant: { priceCents: number },
  design: { wrapChoice?: boolean; wrapUpchargeCents?: number; allOver?: { upchargeCents: number } | null } | null | undefined,
  style: boolean | "panel" | "wrap" | "allover" | null | undefined,
  optionCents = 0,
) {
  const wrap = style === true || style === "wrap";
  const upcharge =
    wrap && design?.wrapChoice ? (design.wrapUpchargeCents ?? 0) : style === "allover" && design?.allOver ? design.allOver.upchargeCents : 0;
  return variant.priceCents + upcharge + optionCents;
}

type OptionDefs = {
  name: string;
  required: boolean;
  choices: { label: string; modCents: number }[];
  showIf?: { option: string; choice: string } | null;
}[];

// The options that show, given the picks so far: an option with showIf only
// shows when that earlier option (itself showing) has that choice.
export function shownOptions<T extends OptionDefs[number]>(defs: T[], chosen: Record<string, string> | null | undefined): T[] {
  const picked: Record<string, string> = {};
  const out: T[] = [];
  for (const o of defs) {
    if (o.showIf && (picked[o.showIf.option] ?? "").toLowerCase() !== o.showIf.choice.toLowerCase()) continue;
    out.push(o);
    const pick = (chosen?.[o.name] ?? "").trim();
    const choice = o.choices.find((c) => c.label.toLowerCase() === pick.toLowerCase());
    if (choice) picked[o.name] = choice.label;
  }
  return out;
}

// What the chosen options add (e.g. Trim: With trim → +500), checking every
// required option is picked and every pick exists. Returns the clean picks.
export function optionsCents(
  defs: OptionDefs,
  chosen: Record<string, string> | null | undefined,
): { cents: number; picks: Record<string, string> } | { error: string } {
  let cents = 0;
  const picks: Record<string, string> = {};
  // Options that don't show aren't required and don't change the price.
  for (const o of shownOptions(defs, chosen)) {
    const pick = (chosen?.[o.name] ?? "").trim();
    if (!pick) {
      if (o.required) return { error: `Please choose ${o.name}.` };
      continue;
    }
    const choice = o.choices.find((c) => c.label.toLowerCase() === pick.toLowerCase());
    if (!choice) return { error: `The ${o.name} you chose isn't available anymore. Please remove it and add it again.` };
    cents += choice.modCents;
    picks[o.name] = choice.label;
  }
  return { cents, picks };
}

// Totals for a cart. Handling is once per order. The studio's own shipping
// applies when the cart has items the studio ships itself; SwaggPress items
// add the shipping option the client chose (labShippingCents).
export function cartTotals(
  lines: PricedLine[],
  settings: { shippingCents: number; handlingCents: number },
  labShippingCents = 0,
) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
  const hasSelf = lines.some((l) => (l.fulfillment ?? "self") === "self");
  const hasLab = lines.some((l) => l.fulfillment === "swaggpress");
  const selfShippingCents = hasSelf ? settings.shippingCents : 0;
  const lab = hasLab ? labShippingCents : 0;
  const shippingCents = selfShippingCents + lab;
  const handlingCents = lines.length > 0 ? settings.handlingCents : 0;
  return {
    subtotalCents,
    shippingCents,
    selfShippingCents,
    labShippingCents: lab,
    handlingCents,
    totalCents: subtotalCents + shippingCents + handlingCents,
  };
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

type FieldDef = {
  key: string;
  label: string;
  max: number;
  required: boolean;
  type: "text" | "select" | "image";
  choices: string[];
  showIf?: { option: string; choice: string } | null;
};

// The fields that show: a field with showIf shows once that option (or an
// earlier dropdown field, by its label) has that choice.
export function shownFields<T extends FieldDef>(
  fields: T[],
  optionPicks: Record<string, string>,
  answers: Record<string, string> | null | undefined,
): T[] {
  const picked = new Map(Object.entries(optionPicks).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]));
  const out: T[] = [];
  for (const f of fields) {
    if (f.showIf && picked.get(f.showIf.option.toLowerCase()) !== f.showIf.choice.toLowerCase()) continue;
    out.push(f);
    if (f.type === "select") {
      const answer = (answers?.[f.key] ?? "").trim().toLowerCase();
      const choice = f.choices.find((c) => c.toLowerCase() === answer);
      if (choice) picked.set(f.label.toLowerCase(), choice.toLowerCase());
    }
  }
  return out;
}

// Checks a Custom Text & Photos product's answers: required fields filled,
// dropdown choices real, text not too long, photo counts within limits.
// Returns the answers by label (what SwaggPress and the studio see) and the
// chosen photos. Fields that don't show are left out.
export function checkFields(
  fields: FieldDef[],
  optionPicks: Record<string, string>,
  answers: Record<string, string> | null | undefined,
  photoPicks: Record<string, string[]> | null | undefined,
): { text: Record<string, string>; photoIds: string[] } | { error: string } {
  const text: Record<string, string> = {};
  const photoIds: string[] = [];
  for (const f of shownFields(fields, optionPicks, answers)) {
    if (f.type === "image") {
      const ids = [...new Set(photoPicks?.[f.key] ?? [])];
      if (ids.length > f.max) return { error: `Choose up to ${f.max} photo${f.max === 1 ? "" : "s"} for ${f.label}.` };
      if (f.required && ids.length === 0) return { error: `Please choose a photo for ${f.label}.` };
      if (ids.length) {
        text[f.label] = `${ids.length} photo${ids.length === 1 ? "" : "s"} attached`;
        photoIds.push(...ids);
      }
      continue;
    }
    const value = (answers?.[f.key] ?? "").trim();
    if (!value) {
      if (f.required) return { error: f.type === "select" ? `Please choose ${f.label}.` : `Please fill in ${f.label}.` };
      continue;
    }
    if (f.type === "select") {
      const choice = f.choices.find((c) => c.toLowerCase() === value.toLowerCase());
      if (!choice) return { error: `Please choose ${f.label} again.` };
      text[f.label] = choice;
    } else {
      if (value.length > f.max) return { error: `${f.label} can be up to ${f.max} characters.` };
      text[f.label] = value;
    }
  }
  return { text, photoIds: [...new Set(photoIds)] };
}

