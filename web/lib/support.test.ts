// Tests for the Support page's contact form.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSupportForm, supportEmail, topicLabel } from "./support.ts";

const filled = {
  role: "photographer",
  topic: "bug",
  name: " Maria Lopez ",
  email: "maria@example.com",
  studio: "",
  pageUrl: "",
  message: "The upload button does nothing on my phone.",
};

test("a filled-in form is accepted and tidied", () => {
  const result = parseSupportForm(filled);
  assert.ok("data" in result);
  assert.equal(result.data.name, "Maria Lopez");
  assert.equal(result.data.studio, null);
  assert.equal(result.data.pageUrl, null);
});

test("each role has its own topics", () => {
  assert.equal(topicLabel("client", "gallery"), "My gallery or downloads");
  assert.equal(topicLabel("photographer", "gallery"), null);
  const result = parseSupportForm({ ...filled, role: "client", topic: "billing" });
  assert.ok("errors" in result);
  assert.equal(result.errors.topic, "Choose what this is about.");
});

test("missing or bad fields come back in plain words", () => {
  const result = parseSupportForm({ ...filled, role: "admin", name: "", email: "nope", message: "hi" });
  assert.ok("errors" in result);
  assert.equal(result.errors.role, "Choose who you are.");
  assert.equal(result.errors.name, "Enter your name.");
  assert.equal(result.errors.email, "Enter a valid email address.");
  assert.equal(result.errors.message, "Tell us a little more so we can help.");
});

test("the owner's email names the sender, the topic, and what they shared", () => {
  const result = parseSupportForm({ ...filled, role: "client", topic: "gallery", studio: "Sunny Day Photo", pageUrl: "https://photoezcloud.com/g/abc" });
  assert.ok("data" in result);
  const email = supportEmail(result.data, { account: null, userAgent: "Safari on iPhone", inboxUrl: "https://photoezcloud.com/dashboard/support" });
  assert.equal(email.subject, "Support: My gallery or downloads (Maria Lopez)");
  assert.deepEqual(email.intro, ["The upload button does nothing on my phone."]);
  assert.deepEqual(email.details, [
    ["From", "Maria Lopez (maria@example.com)"],
    ["Who", "Client of a photographer"],
    ["About", "My gallery or downloads"],
    ["Their photographer", "Sunny Day Photo"],
    ["Page", "https://photoezcloud.com/g/abc"],
    ["Browser", "Safari on iPhone"],
  ]);
});
