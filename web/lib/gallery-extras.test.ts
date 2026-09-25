// Tests for plans and paid extra photo selections.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { extraPhotoPrice, extrasFor } from "./gallery-extras.ts";
import { hasFeature, planFor } from "./plans.ts";

test("gallery upsells come with Pro and Studio", () => {
  assert.equal(hasFeature("free", "galleryUpsells"), false);
  assert.equal(hasFeature("pro", "galleryUpsells"), true);
  assert.equal(hasFeature("studio", "galleryUpsells"), true);
  assert.equal(planFor("galleryUpsells"), "pro");
});

test("a gallery's own price wins over the studio default", () => {
  assert.equal(extraPhotoPrice({ planAllows: true, freeLimit: 10, galleryPriceCents: 1500, studioPriceCents: 1000 }), 1500);
  assert.equal(extraPhotoPrice({ planAllows: true, freeLimit: 10, galleryPriceCents: null, studioPriceCents: 1000 }), 1000);
});

test("no extras without the plan, without a limit, or at a $0 price", () => {
  assert.equal(extraPhotoPrice({ planAllows: false, freeLimit: 10, galleryPriceCents: 1500, studioPriceCents: 1000 }), null);
  assert.equal(extraPhotoPrice({ planAllows: true, freeLimit: 0, galleryPriceCents: null, studioPriceCents: 1000 }), null);
  assert.equal(extraPhotoPrice({ planAllows: true, freeLimit: 10, galleryPriceCents: 0, studioPriceCents: 1000 }), null);
});

test("only selections past the included number cost extra", () => {
  assert.deepEqual(extrasFor(12, 10, 1000), { count: 2, cents: 2000 });
  assert.deepEqual(extrasFor(8, 10, 1000), { count: 0, cents: 0 });
  assert.deepEqual(extrasFor(12, 10, null), { count: 0, cents: 0 });
});
