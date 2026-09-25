// Tests for list reordering.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { moveInList } from "./reorder.ts";

test("moves an item up or down one place", () => {
  assert.deepEqual(moveInList(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveInList(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
});

test("nothing to do at either end, or for an unknown item", () => {
  assert.equal(moveInList(["a", "b"], "a", -1), null);
  assert.equal(moveInList(["a", "b"], "b", 1), null);
  assert.equal(moveInList(["a", "b"], "z", 1), null);
});
