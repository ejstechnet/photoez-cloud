// Recognizing a connected Stripe account that can't be reached (connect.ts).   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { isMissingAccount } from "./connect.ts";

test("an account Stripe doesn't know is recognized, so it can be dropped", () => {
  // Never finished, from the other mode, or disconnected by the photographer.
  assert.equal(isMissingAccount({ code: "account_invalid" }), true);
  assert.equal(isMissingAccount({ code: "resource_missing" }), true);
});

test("other Stripe problems are not mistaken for a missing account", () => {
  // A key without the right permission must not wipe a photographer's real account.
  assert.equal(isMissingAccount({ code: "more_permissions_required" }), false);
  assert.equal(isMissingAccount({ code: "rate_limit" }), false);
  assert.equal(isMissingAccount(new Error("network down")), false);
  assert.equal(isMissingAccount(null), false);
});
