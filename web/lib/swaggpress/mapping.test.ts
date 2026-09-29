// Tests for SwaggPress catalog mapping.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { sellable, suggestedRetailCents, swaggImages, swaggVariantLabel, swaggVariants, swaggDesign, syncSwaggVariants } from "./mapping.ts";

let n = 0;
const makeId = () => `v${++n}`;
const tee = {
  id: 2,
  name: "Custom Tee",
  description: null,
  category: "T-Shirts",
  wholesale_price: 12,
  mockup_front: "https://x/tee.png",
  photos: ["https://x/tee-photo.jpg"],
  full_wrap: false,
  variants: [
    { id: 10, color: "White", color_hex: "#fff", size: "M", wholesale_price: 12, print_w_in: null, print_h_in: null, image: "https://x/tee.png" },
    { id: 11, color: "White", color_hex: "#fff", size: "2XL", wholesale_price: 14.5, print_w_in: null, print_h_in: null, image: null },
  ],
};

test("labels and prices", () => {
  assert.equal(swaggVariantLabel({ color: "White", size: "M" }), "White · M");
  assert.equal(swaggVariantLabel({ color: null, size: "8×10" }), "8×10");
  assert.equal(swaggVariantLabel({ color: " ", size: null }), "Standard");
  assert.equal(suggestedRetailCents(1200), 2400);
  assert.equal(suggestedRetailCents(1450), 2900);
  assert.equal(suggestedRetailCents(250), 750); // at least $5 over wholesale
  assert.deepEqual(swaggImages(tee), ["https://x/tee-photo.jpg", "https://x/tee.png"]);
});

test("a SwaggPress product becomes store sizes", () => {
  const vs = swaggVariants(tee, makeId);
  assert.equal(vs.length, 2);
  assert.deepEqual(
    { label: vs[1].label, price: vs[1].priceCents, wholesale: vs[1].wholesaleCents, lab: vs[1].labVariantId },
    { label: "White · 2XL", price: 2900, wholesale: 1450, lab: 11 },
  );
  const single = swaggVariants({ ...tee, variants: [], wholesale_price: 9 }, makeId);
  assert.deepEqual([single[0].label, single[0].labVariantId, single[0].wholesaleCents], ["Standard", null, 900]);
});

test("syncing keeps the studio's prices and flags dropped sizes", () => {
  const mine = swaggVariants(tee, makeId).map((v) => ({ ...v, priceCents: 3500 }));
  const newer = {
    ...tee,
    variants: [
      { ...tee.variants[0], wholesale_price: 13 },
      { id: 12, color: "Black", color_hex: "#000", size: "M", wholesale_price: 12, print_w_in: null, print_h_in: null, image: null },
    ],
  };
  const synced = syncSwaggVariants(mine, newer, makeId);
  const m = synced.find((v) => v.labVariantId === 10)!;
  assert.equal(m.priceCents, 3500);
  assert.equal(m.wholesaleCents, 1300);
  assert.equal(synced.find((v) => v.labVariantId === 12)?.priceCents, 2400);
  assert.equal(synced.find((v) => v.labVariantId === 11)?.available, false);
  assert.ok(syncSwaggVariants(mine, null, makeId).every((v) => v.available === false));
});

test("only sizes still offered and priced above wholesale are sellable", () => {
  const base = { id: "a", label: "M", priceCents: 2400, widthIn: null, heightIn: null };
  assert.ok(sellable(base));
  assert.ok(sellable({ ...base, wholesaleCents: 1200, available: true }));
  assert.ok(!sellable({ ...base, wholesaleCents: 2400 }));
  assert.ok(!sellable({ ...base, available: false }));
});

test("a product's design setup comes along for the gallery designer", () => {
  assert.equal(swaggDesign(tee), null);
  const mug = {
    ...tee,
    design: {
      canvas: { w: 600, h: 600 },
      front: { mockup: "https://swaggpress.com/m.webp", area: { x: 97, y: 128, w: 427, h: 378 } },
      back: null,
      print_mask: null,
      full_wrap: true,
      print_px: { w: 0, h: 0, dpi: 300 },
    },
  };
  assert.deepEqual(swaggDesign(mug), {
    canvas: { w: 600, h: 600 },
    front: { mockup: "https://swaggpress.com/m.webp", area: { x: 97, y: 128, w: 427, h: 378 } },
    back: null,
    fullWrap: true,
    // 0 × 0 means SwaggPress has no print size set.
    printPx: null,
    wrapChoice: false,
    wrapUpchargeCents: 0,
    wrapInches: null,
  });
  // "Customer chooses", with a $5 upcharge and a wrap size.
  const choosy = { ...mug, design: { ...mug.design, full_wrap: false, wrap_optional: true, wrap_upcharge: 5, wrap_in: { w: 8.5, h: 3.5 } } };
  const setup = swaggDesign(choosy)!;
  assert.equal(setup.wrapChoice, true);
  assert.equal(setup.wrapUpchargeCents, 500);
  assert.deepEqual(setup.wrapInches, { w: 8.5, h: 3.5 });
});
