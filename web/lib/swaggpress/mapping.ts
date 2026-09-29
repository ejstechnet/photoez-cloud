// Turning SwaggPress catalog products into the studio's store products, and
// keeping them in step. Plain functions; tested in mapping.test.ts.

import type { StoreLabDesign, StoreLabField, StoreLabOption, StoreVariant } from "../../db/schema.ts";
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
      // For the gallery designer: this color's product picture and swatch.
      labImage: v?.image ?? null,
      colorHex: v?.color_hex ?? null,
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
      ? { ...had, label: f.label, widthIn: f.widthIn, heightIn: f.heightIn, wholesaleCents: f.wholesaleCents, labImage: f.labImage, colorHex: f.colorHex, available: true }
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

// The product's design setup for the gallery designer; null when SwaggPress
// didn't send one or it has no product picture to design on.
export function swaggDesign(product: SwaggProduct): StoreLabDesign | null {
  const d = product.design;
  if (!d || !d.front?.area) return null;
  const px = d.print_px?.w > 0 && d.print_px?.h > 0 ? d.print_px : null;
  return {
    canvas: { w: d.canvas?.w || 600, h: d.canvas?.h || 600 },
    front: { mockup: d.front.mockup ?? product.mockup_front ?? null, area: d.front.area },
    back: d.back ? { mockup: d.back.mockup ?? null, area: d.back.area } : null,
    fullWrap: Boolean(d.full_wrap),
    printPx: px ? { w: px.w, h: px.h, dpi: px.dpi || 300 } : null,
    wrapChoice: Boolean(d.wrap_optional) && !d.full_wrap,
    wrapUpchargeCents: d.wrap_optional ? cents(d.wrap_upcharge ?? 0) : 0,
    wrapInches: d.wrap_in && d.wrap_in.w > 0 && d.wrap_in.h > 0 ? { w: d.wrap_in.w, h: d.wrap_in.h } : null,
  };
}

// The product's options (e.g. Trim), with price changes in cents.
export function swaggOptions(product: SwaggProduct): StoreLabOption[] {
  return (product.options ?? [])
    .map((o) => ({
      name: String(o.name ?? "").trim().slice(0, 60),
      required: Boolean(o.required),
      choices: (o.choices ?? [])
        .map((c) => ({ label: String(c.label ?? "").trim().slice(0, 80), modCents: cents(Number(c.mod) || 0) }))
        .filter((c) => c.label),
      showIf: o.show_if?.option && o.show_if.choice ? { option: String(o.show_if.option), choice: String(o.show_if.choice) } : null,
    }))
    .filter((o) => o.name && o.choices.length > 0);
}

// How clients order the product (null when SwaggPress didn't say).
export function swaggMode(product: SwaggProduct): "custom_design" | "custom_text" | "standard" | null {
  const mode = product.purchase_mode;
  return mode === "custom_design" || mode === "custom_text" || mode === "standard" ? mode : null;
}

// The fields a Custom Text & Photos product asks for.
export function swaggFields(product: SwaggProduct): StoreLabField[] {
  if (swaggMode(product) !== "custom_text") return [];
  return (product.custom_fields ?? [])
    .map((f) => {
      const type: StoreLabField["type"] = f.type === "select" || f.type === "image" ? f.type : "text";
      return {
        key: String(f.key ?? "").slice(0, 40),
        label: String(f.label ?? "").trim().slice(0, 80),
        placeholder: String(f.placeholder ?? "").slice(0, 120),
        max: Math.max(1, Math.min(type === "image" ? 10 : 500, Math.round(Number(f.max) || (type === "image" ? 1 : 50)))),
        required: Boolean(f.required),
        type,
        choices: type === "select" ? (f.options ?? []).map((c) => String(c).trim().slice(0, 80)).filter(Boolean) : [],
        showIf: f.show_if?.option && f.show_if.choice ? { option: String(f.show_if.option), choice: String(f.show_if.choice) } : null,
      };
    })
    .filter((f) => f.key && f.label && (f.type !== "select" || f.choices.length > 0));
}
