// Tests for the Online Store's rules.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cartTotals,
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
    { subtotalCents: 7500, shippingCents: 800, handlingCents: 300, totalCents: 8600 },
  );
  assert.equal(cartTotals([], settings).totalCents, 0);
});

test("order numbers and tracking links", () => {
  assert.match(orderNumber(new Uint8Array([0, 1, 2, 3, 4, 5])), /^PEZ-[A-Z2-9]{6}$/);
  assert.equal(trackingUrl("USPS", "9400 1"), "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400%201");
  assert.equal(trackingUrl("Other", "123"), null);
  assert.equal(trackingUrl("ups", null), null);
});
