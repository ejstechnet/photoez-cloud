// The "Save to PhotoEZ Growth" bookmark and the capture page's readers.
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { CAPTURE_MESSAGE, MAX_CAPTURE_TEXT, bookmarkletCode, readCaptureMessage, splitPasted, tidyTitle } from "./capture.ts";

test("the bookmark is one line, sends only to PhotoEZ Cloud, and waits for the page", () => {
  const code = bookmarkletCode("https://photoezcloud.com");
  assert.ok(code.startsWith("javascript:(()=>{"));
  assert.ok(!code.includes("\n"));
  // Bookmarks over ~2,000 characters fail in some browsers.
  assert.ok(code.length < 2000, `${code.length} characters`);
  assert.ok(code.includes('const o="https://photoezcloud.com"'));
  // Hands the text only to a PhotoEZ Cloud window it opened, after it says ready.
  assert.ok(code.includes("e.origin===o&&e.source===w"));
  assert.ok(code.includes("w.postMessage({type:"));
  assert.ok(code.includes("},o)"));
  // The code itself must parse.
  assert.doesNotThrow(() => new Function(code.slice("javascript:".length)));
});

test("bookmark messages are read as plain, capped text", () => {
  const long = "x".repeat(MAX_CAPTURE_TEXT + 50);
  assert.deepEqual(readCaptureMessage({ type: CAPTURE_MESSAGE, url: " https://www.facebook.com/groups/1/posts/2 ", title: " Photo Biz ", text: long }), {
    url: "https://www.facebook.com/groups/1/posts/2",
    title: "Photo Biz",
    text: "x".repeat(MAX_CAPTURE_TEXT),
  });
  assert.equal(readCaptureMessage({ type: "something-else", url: "https://a.com" }), null);
  assert.equal(readCaptureMessage({ type: CAPTURE_MESSAGE, url: "javascript:alert(1)" }), null);
  assert.equal(readCaptureMessage({ type: CAPTURE_MESSAGE, url: { toString: () => "https://a.com" } }), null);
  assert.equal(readCaptureMessage("https://a.com"), null);
  assert.equal(readCaptureMessage(null), null);
});

test("pasted link + text is split apart", () => {
  assert.deepEqual(splitPasted("https://www.facebook.com/groups/1/posts/2\nAnyone use Pixieset?\nIt's pricey."), {
    url: "https://www.facebook.com/groups/1/posts/2",
    text: "Anyone use Pixieset?\nIt's pricey.",
  });
  assert.deepEqual(splitPasted("Which gallery app? https://forum.example.com/t/9 thanks"), {
    url: "https://forum.example.com/t/9",
    text: "Which gallery app?  thanks",
  });
  assert.deepEqual(splitPasted("No link here"), { url: "", text: "No link here" });
});

test("tab titles lose the site name and the notification count", () => {
  assert.equal(tidyTitle("(3) Photography Business Owners | Facebook"), "Photography Business Owners");
  assert.equal(tidyTitle("Which gallery app do you use? - Reddit"), "Which gallery app do you use?");
  assert.equal(tidyTitle("FredMiranda Forums"), "FredMiranda Forums");
});
