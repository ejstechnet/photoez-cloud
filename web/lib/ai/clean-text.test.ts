// Tests for the draft-reply text cleanup.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanReplyText, hasGarbledText } from "./clean-text.ts";

test("turns a written-out escape code back into the character", () => {
  assert.equal(cleanReplyText("birthday \\u2014 such fun"), "birthday — such fun");
});

test("repairs punctuation garbled by the wrong encoding", () => {
  assert.equal(cleanReplyText("graduation ‚Äî senior"), "graduation — senior");
  assert.equal(cleanReplyText("I‚Äôd love to"), "I’d love to");
  assert.equal(cleanReplyText("that â€” and â€œthisâ€"), "that — and “this”");
});

test("fixes full-width punctuation", () => {
  assert.equal(cleanReplyText("Hi there，thanks！"), "Hi there,thanks!");
});

test("repairs a full-width character escape that lost its u", () => {
  // Seen in the eval: "：" (full-width colon) arrived as a form feed + "f1a".
  assert.equal(cleanReplyText("18th birthday \ff1a what a fun"), "18th birthday : what a fun");
  assert.equal(cleanReplyText("see /book \ff0d the booking page"), "see /book - the booking page");
  // Stray control characters go; line breaks and tabs stay; words like "add" and "f1" are untouched.
  assert.equal(cleanReplyText("a\u0007b\nc\td add f1"), "ab\nc\td add f1");
});

test("leaves normal text alone", () => {
  const reply = "Thank you — I’d love to photograph “both” of you… Café at 3:00, 50% of the way.";
  assert.equal(cleanReplyText(reply), reply);
  assert.equal(hasGarbledText(reply), false);
  assert.equal(hasGarbledText("oops ‚Äî"), true);
});
