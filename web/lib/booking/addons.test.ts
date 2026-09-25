// Tests for booking add-on math.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { pickAddons, type OfferedAddon } from "./addons.ts";

const edits: OfferedAddon = { id: "edits", name: "Edited photos", priceCents: 1000, maxQuantity: 50, includedQuantity: 15 };
const print: OfferedAddon = { id: "print", name: "11x17 glossy print", priceCents: 1500, maxQuantity: 10, includedQuantity: 0 };
const offered = [edits, print];

test("adds up the extras, in the session's order", () => {
  const result = pickAddons(offered, { print: 2, edits: 5 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.lines.map((l) => [l.id, l.quantity, l.lineCents]),
    [
      ["edits", 5, 5000],
      ["print", 2, 3000],
    ],
  );
  assert.equal(result.addonsCents, 8000);
});

test("nothing picked costs nothing", () => {
  assert.deepEqual(pickAddons(offered, { edits: 0 }), { ok: true, lines: [], addonsCents: 0 });
  assert.deepEqual(pickAddons(offered, {}), { ok: true, lines: [], addonsCents: 0 });
});

test("refuses more than the limit", () => {
  const result = pickAddons(offered, { print: 11 });
  assert.deepEqual(result, { ok: false, message: "You can add up to 10 of 11x17 glossy print." });
});

test("refuses negative, fractional, and unknown extras", () => {
  assert.equal(pickAddons(offered, { print: -1 }).ok, false);
  assert.equal(pickAddons(offered, { print: 1.5 }).ok, false);
  assert.equal(pickAddons(offered, { album: 1 }).ok, false);
});
