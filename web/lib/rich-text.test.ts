// Tests for the rich-text cleaner.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanRichTextInput, richTextHtml, richTextToPlain } from "./rich-text.ts";

test("keeps simple formatting", () => {
  const html = "<p><strong>Hi</strong> <em>there</em></p><ul><li>One</li></ul>";
  assert.equal(cleanRichTextInput(html), html);
});

test("removes scripts, event handlers, and styles", () => {
  const clean = cleanRichTextInput('<p onclick="x()" style="color:red">Hi<script>alert(1)</script><img src=x onerror=alert(1)></p>');
  assert.equal(clean, "<p>Hi</p>");
});

test("links open safely in a new tab; javascript: links are dropped", () => {
  assert.equal(
    cleanRichTextInput('<p><a href="https://example.com">site</a></p>'),
    '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">site</a></p>',
  );
  assert.equal(cleanRichTextInput('<p><a href="javascript:alert(1)">x</a></p>'), '<p><a target="_blank" rel="noopener noreferrer nofollow">x</a></p>');
});

test("an empty editor saves as nothing", () => {
  assert.equal(cleanRichTextInput("<p></p>"), null);
  assert.equal(cleanRichTextInput("<p> </p><p><br></p>"), null);
});

test("older plain text becomes paragraphs, escaped", () => {
  assert.equal(richTextHtml("Line one\nline two\n\n<b>Next</b>"), "<p>Line one<br>line two</p><p>&lt;b&gt;Next&lt;/b&gt;</p>");
});

test("plain version keeps paragraph breaks", () => {
  assert.equal(richTextToPlain("<p>One</p><p>Two &amp; three</p>"), "One\nTwo & three");
});
