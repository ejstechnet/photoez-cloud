// Tests for sealing secrets at rest.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { openSecret, sealSecret } from "./secret-box.ts";

test("a sealed secret opens with the same app secret only", () => {
  const sealed = sealSecret("spk_abc123", "app-secret-one");
  assert.match(sealed, /^v1\./);
  assert.ok(!sealed.includes("spk_abc123"));
  assert.equal(openSecret(sealed, "app-secret-one"), "spk_abc123");
  assert.equal(openSecret(sealed, "app-secret-two"), null);
});

test("tampering is caught", () => {
  const sealed = sealSecret("spk_abc123", "s");
  const parts = sealed.split(".");
  parts[3] = Buffer.from("spk_evil").toString("base64url");
  assert.equal(openSecret(parts.join("."), "s"), null);
  assert.equal(openSecret("garbage", "s"), null);
});

test("each seal is different (random IV)", () => {
  assert.notEqual(sealSecret("x", "s"), sealSecret("x", "s"));
});
