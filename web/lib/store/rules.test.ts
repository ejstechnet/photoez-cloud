// Tests for the Online Store's rules.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cartTotals,
  itemUnitCents,
  optionsCents,
  shownOptions,
  checkFields,
  shownFields,
  centeredCrop,
  cropFits,
  cropPixels,
  orderNumber,
  parsePrice,
  trackingUrl,
  variantRatio,
} from "./rules.ts";

test("prices", () => {
  assert.equal(parsePrice("$25"), 2500);
  assert.equal(parsePrice("25.5"), 2550);
  assert.equal(parsePrice("0.10"), null);
  assert.equal(parsePrice("abc"), null);
});

test("an 8×10 fits a portrait or landscape crop", () => {
  const ratio = variantRatio({ widthIn: 8, heightIn: 10 })!;
  assert.equal(ratio, 1.25);
  assert.equal(variantRatio({ widthIn: null, heightIn: null }), null);
  const portrait = { width: 4000, height: 6000 };
  const crop = centeredCrop(portrait, ratio);
  // Full width, 4000×5000 px, centered top to bottom.
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  near(crop.x, 0);
  near(crop.width, 1);
  near(crop.height, 5000 / 6000);
  near(crop.y, (1 - 5000 / 6000) / 2);
  assert.ok(cropFits(crop, portrait, ratio));
  // A landscape 8×10 crop from the same photo also fits.
  assert.ok(cropFits({ x: 0, y: 0, width: 1, height: 3200 / 6000 }, portrait, ratio));
  // A square doesn't, and neither does a crop off the edge.
  assert.ok(!cropFits({ x: 0, y: 0, width: 1, height: 4000 / 6000 }, portrait, ratio));
  assert.ok(!cropFits({ x: 0.5, y: 0, width: 1, height: 5000 / 6000 }, portrait, ratio));
});

test("a landscape photo gets a landscape crop to start", () => {
  const crop = centeredCrop({ width: 6000, height: 4000 }, 1.5);
  assert.deepEqual(crop, { x: 0, y: 0, width: 1, height: 1 });
});

test("crop pixels stay inside the photo", () => {
  assert.deepEqual(cropPixels({ x: 0.1, y: 0.2, width: 0.9, height: 0.8 }, { width: 1000, height: 500 }), {
    left: 100,
    top: 100,
    width: 900,
    height: 400,
  });
});

test("totals add shipping and handling once per order", () => {
  const settings = { shippingCents: 800, handlingCents: 300 };
  assert.deepEqual(
    cartTotals(
      [
        { unitCents: 3000, quantity: 2 },
        { unitCents: 1500, quantity: 1 },
      ],
      settings,
    ),
    { subtotalCents: 7500, shippingCents: 800, selfShippingCents: 800, labShippingCents: 0, handlingCents: 300, totalCents: 8600 },
  );
  assert.equal(cartTotals([], settings).totalCents, 0);
  // SwaggPress items only: the chosen rate, not the studio's shipping.
  assert.deepEqual(cartTotals([{ unitCents: 2400, quantity: 1, fulfillment: "swaggpress" }], settings, 540), {
    subtotalCents: 2400, shippingCents: 540, selfShippingCents: 0, labShippingCents: 540, handlingCents: 300, totalCents: 3240,
  });
  // Mixed: both shipments, handling once.
  assert.equal(
    cartTotals([{ unitCents: 3000, quantity: 1 }, { unitCents: 2400, quantity: 1, fulfillment: "swaggpress" }], settings, 540).totalCents,
    3000 + 2400 + 800 + 540 + 300,
  );
});

test("order numbers and tracking links", () => {
  assert.match(orderNumber(new Uint8Array([0, 1, 2, 3, 4, 5])), /^PEZ-[A-Z2-9]{6}$/);
  assert.equal(trackingUrl("USPS", "9400 1"), "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400%201");
  assert.equal(trackingUrl("Other", "123"), null);
  assert.equal(trackingUrl("ups", null), null);
});

test("a full wrap adds its upcharge only on products that offer the choice", () => {
  const size = { priceCents: 2800 };
  const choosy = { wrapChoice: true, wrapUpchargeCents: 500 };
  assert.equal(itemUnitCents(size, choosy, true), 3300);
  assert.equal(itemUnitCents(size, choosy, false), 2800);
  // Always-wrap products are priced by size alone.
  assert.equal(itemUnitCents(size, { wrapChoice: false, wrapUpchargeCents: 500 }, true), 2800);
  assert.equal(itemUnitCents(size, null, true), 2800);
});

test("options add their price changes and required ones must be picked", () => {
  const defs = [
    { name: "Trim", required: true, choices: [{ label: "Without trim", modCents: 0 }, { label: "With trim", modCents: 500 }] },
    { name: "Box", required: false, choices: [{ label: "Gift box", modCents: 300 }] },
  ];
  assert.deepEqual(optionsCents(defs, { Trim: "with trim" }), { cents: 500, picks: { Trim: "With trim" } });
  assert.deepEqual(optionsCents(defs, { Trim: "With trim", Box: "Gift box" }), { cents: 800, picks: { Trim: "With trim", Box: "Gift box" } });
  assert.deepEqual(optionsCents(defs, {}), { error: "Please choose Trim." });
  assert.ok("error" in optionsCents(defs, { Trim: "Silver" }));
  assert.deepEqual(optionsCents([], null), { cents: 0, picks: {} });
  assert.equal(itemUnitCents({ priceCents: 4000 }, null, false, 500), 4500);
});

test("an option can show only when an earlier option has a certain choice", () => {
  const defs = [
    { name: "Trim", required: true, choices: [{ label: "Without trim", modCents: 0 }, { label: "With trim", modCents: 500 }] },
    {
      name: "Trim Type",
      required: true,
      choices: [{ label: "Gold", modCents: 0 }, { label: "Silver", modCents: 200 }],
      showIf: { option: "Trim", choice: "With trim" },
    },
  ];
  assert.deepEqual(shownOptions(defs, { Trim: "Without trim" }).map((o) => o.name), ["Trim"]);
  assert.deepEqual(shownOptions(defs, { Trim: "With trim" }).map((o) => o.name), ["Trim", "Trim Type"]);
  // Hidden: not required, not priced, and a stray pick is dropped.
  assert.deepEqual(optionsCents(defs, { Trim: "Without trim", "Trim Type": "Silver" }), { cents: 0, picks: { Trim: "Without trim" } });
  assert.deepEqual(optionsCents(defs, { Trim: "With trim", "Trim Type": "Silver" }), { cents: 700, picks: { Trim: "With trim", "Trim Type": "Silver" } });
  assert.deepEqual(optionsCents(defs, { Trim: "With trim" }), { error: "Please choose Trim Type." });
});

test("personalize fields: conditions, required answers and photo limits", () => {
  const fields = [
    { key: "trim_type", label: "Trim Type", max: 50, required: true, type: "select" as const, choices: ["Satin", "Sequin"], showIf: { option: "Trim", choice: "With Trim" } },
    { key: "trim_color", label: "Trim Color", max: 50, required: true, type: "text" as const, choices: [], showIf: { option: "Trim Type", choice: "Satin" } },
    { key: "name", label: "Graduate Name", max: 10, required: true, type: "text" as const, choices: [] },
    { key: "photos", label: "Photos", max: 2, required: true, type: "image" as const, choices: [] },
  ];
  // Without trim: the trim fields are hidden (and not required).
  assert.deepEqual(shownFields(fields, { Trim: "Without Trim" }, {}).map((f) => f.key), ["name", "photos"]);
  assert.deepEqual(checkFields(fields, { Trim: "Without Trim" }, { name: "Mylee", trim_type: "Sequin" }, { photos: ["a"] }), {
    text: { "Graduate Name": "Mylee", Photos: "1 photo attached" },
    photoIds: ["a"],
  });
  // With trim: Trim Type shows; Trim Color shows only for Satin (a dropdown field controls it).
  assert.deepEqual(shownFields(fields, { Trim: "with trim" }, { trim_type: "satin" }).map((f) => f.key), ["trim_type", "trim_color", "name", "photos"]);
  assert.deepEqual(checkFields(fields, { Trim: "With Trim" }, { name: "Mylee" }, { photos: ["a"] }), { error: "Please choose Trim Type." });
  assert.deepEqual(checkFields(fields, { Trim: "With Trim" }, { name: "Mylee", trim_type: "Satin" }, { photos: ["a"] }), { error: "Please fill in Trim Color." });
  assert.deepEqual(checkFields(fields, {}, { name: "Mylee Thompson" }, { photos: ["a"] }), { error: "Graduate Name can be up to 10 characters." });
  assert.deepEqual(checkFields(fields, {}, { name: "Mylee" }, { photos: [] }), { error: "Please choose a photo for Photos." });
  assert.ok("error" in checkFields(fields, {}, { name: "Mylee" }, { photos: ["a", "b", "c"] }));
});

test("an all-over print adds its upcharge only when the product offers it", () => {
  const size = { priceCents: 3000 };
  assert.equal(itemUnitCents(size, { allOver: { upchargeCents: 1000 } }, "allover"), 4000);
  assert.equal(itemUnitCents(size, { allOver: { upchargeCents: 1000 } }, "panel"), 3000);
  assert.equal(itemUnitCents(size, { allOver: null }, "allover"), 3000);
  assert.equal(itemUnitCents(size, { wrapChoice: true, wrapUpchargeCents: 500 }, "wrap"), 3500);
});

test("a back design adds the back upcharge, only when the product has a back", () => {
  const size = { priceCents: 3000 };
  const tee = { back: { mockup: null }, backUpchargeCents: 500 };
  assert.equal(itemUnitCents(size, tee, "panel", 0, true), 3500);
  assert.equal(itemUnitCents(size, tee, "panel", 0, false), 3000);
  assert.equal(itemUnitCents(size, { ...tee, back: null }, "panel", 0, true), 3000);
  assert.equal(itemUnitCents(size, { ...tee, allOver: { upchargeCents: 1000 } }, "allover", 200, true), 4700);
});
