// Tests for gift card rules.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkGiftAmount, giftCardApplies, giftCode, normalizeGiftCode, parseAmountList } from "./gift-card-rules.ts";

test("codes look like GIFT-XXXX-XXXX with no look-alike characters", () => {
  const code = giftCode(new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253]));
  assert.match(code, /^GIFT-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(!/[01OIL]/.test(code.slice(5)));
});

test("typed codes are tidied", () => {
  assert.equal(normalizeGiftCode("gift 7kq2 m9xd"), "GIFT-7KQ2-M9XD");
  assert.equal(normalizeGiftCode("7KQ2M9XD"), "GIFT-7KQ2-M9XD");
  assert.equal(normalizeGiftCode(" nope "), "NOPE");
});

test("amounts: presets always, custom only inside the range", () => {
  const withCustom = { amounts: [5000, 10000], minCents: 2500, maxCents: 50000 };
  assert.equal(checkGiftAmount(5000, withCustom), null);
  assert.equal(checkGiftAmount(7500, withCustom), null);
  assert.match(checkGiftAmount(1000, withCustom)!, /from \$25 to \$500/);
  assert.match(checkGiftAmount(7550, withCustom)!, /whole-dollar/);
  const presetsOnly = { amounts: [5000], minCents: null, maxCents: null };
  assert.match(checkGiftAmount(7500, presetsOnly)!, /amounts shown/);
  assert.match(checkGiftAmount(0, presetsOnly)!, /Choose an amount/);
});

test("a card covers what's owed, up to its balance", () => {
  assert.equal(giftCardApplies(10000, 32500), 10000);
  assert.equal(giftCardApplies(50000, 32500), 32500);
  assert.equal(giftCardApplies(5000, 0), 0);
});

test("preset amount lists", () => {
  assert.deepEqual(parseAmountList("$100, 50  250"), [5000, 10000, 25000]);
  assert.equal(parseAmountList(""), null);
  assert.equal(parseAmountList("50, abc"), null);
});
