// The store's "coming soon" switch (launch.ts).   npm test
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { storeIsOpen, storeOpenFor } from "./launch.ts";

const saved = { open: process.env.STORE_OPEN, owners: process.env.OWNER_EMAILS };
// (Assigning undefined to process.env stores the string "undefined".)
const restore = (key: string, value: string | undefined) => (value === undefined ? delete process.env[key] : (process.env[key] = value));
afterEach(() => {
  restore("STORE_OPEN", saved.open);
  restore("OWNER_EMAILS", saved.owners);
});

test("coming soon: only the owner can use the store", () => {
  delete process.env.STORE_OPEN;
  process.env.OWNER_EMAILS = "owner@example.com";
  assert.equal(storeIsOpen(), false);
  assert.equal(storeOpenFor("Owner@Example.com "), true);
  assert.equal(storeOpenFor("photographer@example.com"), false);
  assert.equal(storeOpenFor(null), false);
});

test("STORE_OPEN=1 opens it to everyone; anything else keeps it closed", () => {
  process.env.OWNER_EMAILS = "";
  process.env.STORE_OPEN = "1";
  assert.equal(storeOpenFor("photographer@example.com"), true);
  process.env.STORE_OPEN = "true";
  assert.equal(storeOpenFor("photographer@example.com"), false);
});
