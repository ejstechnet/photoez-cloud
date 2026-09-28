// Turning SwaggPress catalog products into the studio's store products, and
// keeping them in step. Plain functions; tested in mapping.test.ts.

import type { StoreVariant } from "../../db/schema.ts";
import type { SwaggProduct, SwaggVariant } from "./client.ts";

const cents = (dollars: number) => Math.round(dollars * 100);

// "White · M", "8×10", or "Standard" when there's nothing to tell apart.
export function swaggVariantLabel(v: Pick<SwaggVariant, "color" | "size">) {
  return [v.color, v.size].map((part) => part?.trim()).filter(Boolean).join(" · ") || "Standard";
}

// A starting retail price: twice wholesale, rounded up to a whole dollar,
// and always at least $5 over wholesale. The studio can change it.
export function suggestedRetailCents(wholesaleCents: number) {
  return Math.max(Math.ceil((wholesaleCents * 2) / 100) * 100, wholesaleCents + 500);
}

// Photos to show: SwaggPress's product photos, then its mockups, no repeats.
export function swaggImages(p: SwaggProduct) {
  return [...new Set([...p.photos, p.mockup_front, ...p.variants.map((v) => v.image)].filter((u): u is string => Boolean(u)))].slice(0, 8);
}

// A new store product's sizes from a SwaggPress product. Products with no
// variants are one "Standard" size.
export function swaggVariants(p: SwaggProduct, makeId: () => string): StoreVariant[] {
  const source: (SwaggVariant | null)[] = p.variants.length > 0 ? p.variants : [null];
  return source.map((v) => {
    const wholesaleCents = cents(v ? v.wholesale_price : p.wholesale_price);
    return {
      id: makeId(),
      label: v ? swaggVariantLabel(v) : "Standard",
      priceCents: suggestedRetailCents(wholesaleCents),
      widthIn: v?.print_w_in ?? null,
      heightIn: v?.print_h_in ?? null,
      labVariantId: v?.id ?? null,
      wholesaleCents,
      available: true,
    };
  });
}

// Refreshes an added product's sizes from the current catalog: wholesale
// prices and print sizes follow SwaggPress, the studio's own prices stay,
// sizes SwaggPress dropped are marked unavailable, and new ones are added.
export function syncSwaggVariants(current: StoreVariant[], p: SwaggProduct | null, makeId: () => string): StoreVariant[] {
  if (!p) return current.map((v) => ({ ...v, available: false }));
  const fresh = swaggVariants(p, makeId);
  const byLab = new Map(current.map((v) => [v.labVariantId ?? null, v]));
  const merged = fresh.map((f) => {
    const had = byLab.get(f.labVariantId ?? null);
    return had
      ? { ...had, label: f.label, widthIn: f.widthIn, heightIn: f.heightIn, wholesaleCents: f.wholesaleCents, available: true }
      : f;
  });
  const keptIds = new Set(fresh.map((f) => f.labVariantId ?? null));
  const dropped = current.filter((v) => !keptIds.has(v.labVariantId ?? null)).map((v) => ({ ...v, available: false }));
  return [...merged, ...dropped];
}

// Whether clients may buy a size: still offered, and priced above wholesale
// (so a price change at SwaggPress never makes a studio sell at a loss).
export function sellable(v: StoreVariant) {
  return v.available !== false && (v.wholesaleCents == null || v.priceCents > v.wholesaleCents);
}
