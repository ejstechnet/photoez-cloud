// Tests for SwaggPress catalog mapping.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { autoSwaggVariants, sameJson, sellable, suggestedRetailCents, swaggImages, swaggVariantLabel, swaggVariants, swaggDesign, swaggFields, swaggMode, swaggOptions, syncSwaggVariants } from "./mapping.ts";

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
    front: { mockup: "https://swaggpress.com/m.webp", area: { x: 97, y: 128, w: 427, h: 378 }, overlay: null },
    back: null,
    fullWrap: true,
    // 0 × 0 means SwaggPress has no print size set.
    printPx: null,
    wrapChoice: false,
    wrapUpchargeCents: 0,
    wrapInches: null,
    allOver: null,
    view3d: null,
    backUpchargeCents: 0,
  });
  // A hoodie's 3D model and drawstring overlay come along; unknown models don't.
  const hoodie = { ...mug, design: { ...mug.design, full_wrap: false, view3d: "hoodie", front: { ...mug.design.front, overlay: "https://swaggpress.com/o.png" } } };
  assert.equal(swaggDesign(hoodie)!.view3d, "hoodie");
  assert.equal(swaggDesign(hoodie)!.front.overlay, "https://swaggpress.com/o.png");
  assert.equal(swaggDesign({ ...mug, design: { ...mug.design, view3d: "spaceship" } })!.view3d, null);
  // All-over printing comes along with its upcharge in cents.
  const allOverTee = { ...mug, design: { ...mug.design, full_wrap: false, allover: { upcharge: 10, inches: { w: 20, h: 28 } } } };
  assert.deepEqual(swaggDesign(allOverTee)!.allOver, { upchargeCents: 1000, inches: { w: 20, h: 28 } });
  // "Customer chooses", with a $5 upcharge and a wrap size.
  const choosy = { ...mug, design: { ...mug.design, full_wrap: false, wrap_optional: true, wrap_upcharge: 5, wrap_in: { w: 8.5, h: 3.5 } } };
  const setup = swaggDesign(choosy)!;
  assert.equal(setup.wrapChoice, true);
  assert.equal(setup.wrapUpchargeCents, 500);
  assert.deepEqual(setup.wrapInches, { w: 8.5, h: 3.5 });
});

test("a product's options come along with their price changes in cents", () => {
  assert.deepEqual(swaggOptions(tee), []);
  const stole = {
    ...tee,
    options: [
      { name: "Trim", required: true, choices: [{ label: "Without trim", mod: 0 }, { label: "With trim", mod: 5 }] },
      { name: "  ", required: false, choices: [{ label: "x", mod: 1 }] },
    ],
  };
  assert.deepEqual(swaggOptions(stole), [
    { name: "Trim", required: true, choices: [{ label: "Without trim", modCents: 0 }, { label: "With trim", modCents: 500 }], showIf: null },
  ]);
  const withType = {
    ...tee,
    options: [
      { name: "Trim", required: true, choices: [{ label: "With trim", mod: 5 }] },
      { name: "Trim Type", required: true, choices: [{ label: "Gold", mod: 0 }], show_if: { option: "Trim", choice: "With trim" } },
    ],
  };
  assert.deepEqual(swaggOptions(withType)[1].showIf, { option: "Trim", choice: "With trim" });
});

test("a Custom Text & Photos product's fields come along", () => {
  assert.equal(swaggMode(tee), null);
  assert.deepEqual(swaggFields(tee), []);
  const stole = {
    ...tee,
    purchase_mode: "custom_text" as const,
    custom_fields: [
      { key: "trim_type", label: "Trim Type", type: "select" as const, options: ["Satin"], required: true, show_if: { option: "Trim", choice: "With Trim" } },
      { key: "photos", label: "Photos", type: "image" as const, max: 40, source: "gallery" as const },
      { key: "empty", label: "Empty dropdown", type: "select" as const, options: [] },
    ],
  };
  assert.equal(swaggMode(stole), "custom_text");
  assert.deepEqual(swaggFields(stole), [
    { key: "trim_type", label: "Trim Type", placeholder: "", max: 50, required: true, type: "select", source: "upload", choices: ["Satin"], showIf: { option: "Trim", choice: "With Trim" } },
    { key: "photos", label: "Photos", placeholder: "", max: 10, required: false, type: "image", source: "gallery", choices: [], showIf: null },
  ]);
  // Designer products ask for no fields.
  assert.deepEqual(swaggFields({ ...stole, purchase_mode: "custom_design" as const }), []);
});


test("automatic update: increases and dropped sizes apply now, the rest waits for Refresh", () => {
  const current = swaggVariants(tee, makeId).map((v) => ({ ...v, priceCents: 3000 }));
  // SwaggPress: M up $12 → $13, 2XL down $14.50 → $13.50, a new 3XL.
  const changed = {
    ...tee,
    variants: [
      { ...tee.variants[0], wholesale_price: 13 },
      { ...tee.variants[1], wholesale_price: 13.5 },
      { id: 12, color: "White", color_hex: "#fff", size: "3XL", wholesale_price: 15, print_w_in: null, print_h_in: null, image: null },
    ],
  };
  const { variants, changes } = autoSwaggVariants(current, changed, makeId);
  assert.equal(variants.length, 2); // the new size isn't added until Refresh
  assert.equal(variants[0].wholesaleCents, 1300); // increase applied
  assert.equal(variants[1].wholesaleCents, 1450); // decrease waits
  assert.equal(variants[0].priceCents, 3000); // the studio's own price stays
  assert.deepEqual(
    changes.map((c) => [c.label, c.kind, c.fromCents, c.toCents, c.applied]),
    [
      ["White · M", "up", 1200, 1300, true],
      ["White · 2XL", "down", 1450, 1350, false],
      ["White · 3XL", "new", null, 1500, false],
    ],
  );

  // A size SwaggPress stopped offering is hidden right away.
  const dropped = autoSwaggVariants(current, { ...tee, variants: [tee.variants[0]] }, makeId);
  assert.equal(dropped.variants[1].available, false);
  assert.deepEqual(dropped.changes.map((c) => [c.kind, c.applied]), [["gone", true]]);

  // Nothing changed: nothing to report.
  assert.deepEqual(autoSwaggVariants(current, tee, makeId).changes, []);
  // The whole product gone.
  assert.deepEqual(autoSwaggVariants(current, null, makeId).changes.map((c) => c.kind), ["gone"]);
});

test("sameJson ignores key order", () => {
  assert.equal(sameJson({ a: 1, b: { c: 2, d: [1, { e: 3, f: 4 }] } }, { b: { d: [1, { f: 4, e: 3 }], c: 2 }, a: 1 }), true);
  assert.equal(sameJson({ a: 1 }, { a: 2 }), false);
  assert.equal(sameJson({ a: undefined, b: 1 }, { b: 1 }), true);
});
