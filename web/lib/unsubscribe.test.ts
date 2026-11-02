// Tests for the signed unsubscribe links.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { studioFromUnsubscribeToken, unsubscribeToken } from "./unsubscribe.ts";

const ID = "2f1c9a3e-5b7d-4e8f-9a1b-3c5d7e9f1a2b";
const OTHER = "9a1b3c5d-7e9f-4a2b-8c4d-6e8f0a2b4c6d";

test("a link opens only for the studio it was made for", () => {
  const token = unsubscribeToken(ID, "secret");
  assert.equal(studioFromUnsubscribeToken(token, "secret"), ID);
  // Someone swapping in another studio's id, or a different server secret.
  assert.equal(studioFromUnsubscribeToken(`${OTHER}.${token.split(".")[1]}`, "secret"), null);
  assert.equal(studioFromUnsubscribeToken(token, "other secret"), null);
  // Cut short or junk.
  assert.equal(studioFromUnsubscribeToken(token.slice(0, -3), "secret"), null);
  assert.equal(studioFromUnsubscribeToken("nonsense", "secret"), null);
  assert.equal(studioFromUnsubscribeToken(`${ID}.`, "secret"), null);
});
