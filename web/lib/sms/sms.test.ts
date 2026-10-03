// Tests for texting: phone numbers, wording, reply words, and Twilio signatures.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPhone, maskPhone, toE164 } from "./phone.ts";
import { deliveryError, galleryReadyText, newInquiryAlert, paymentDueText, replyKeyword, sessionReminderText, settingsWithDefaults } from "./messages.ts";
import { twilioSignature, validTwilioSignature } from "./signature.ts";

test("phone numbers become +1 numbers", () => {
  assert.equal(toE164("(503) 555-1234"), "+15035551234");
  assert.equal(toE164("503.555.1234"), "+15035551234");
  assert.equal(toE164("1-503-555-1234"), "+15035551234");
  assert.equal(toE164("+44 20 7946 0958"), "+442079460958");
  assert.equal(toE164("555-1234"), null);
  assert.equal(toE164(""), null);
  assert.equal(toE164("123-456-7890"), null);
  assert.equal(formatPhone("+15035551234"), "(503) 555-1234");
  assert.equal(maskPhone("+15035551234"), "(503) •••-1234");
});

test("client texts name the studio and say how to stop", () => {
  const text = sessionReminderText({ studio: "Bright Studio", client: "Tina Smith", session: "Senior", when: "Sat, Oct 10 at 10:00 AM", url: "https://x.co/b" });
  assert.match(text, /^Bright Studio: Hi Tina,/);
  assert.match(text, /Reply STOP to opt out\.$/);
  assert.match(paymentDueText({ studio: "S", client: "Jo", what: "balance", amountCents: 12550, due: "Nov 1", url: "u" }), /\$125\.50 is due Nov 1/);
  assert.match(paymentDueText({ studio: "S", client: "Jo", what: "balance", amountCents: 100, due: "Nov 1", url: "u", overdue: true }), /was due Nov 1/);
  assert.ok(galleryReadyText({ studio: "S", client: "Jo", url: "https://photoezcloud.com/g/abc" }).length < 160);
  assert.ok(newInquiryAlert({ from: "Jo", summary: "x".repeat(300), url: "u" }).length < 200);
});

test("reply words", () => {
  assert.equal(replyKeyword(" stop "), "out");
  assert.equal(replyKeyword("Unsubscribe."), "out");
  assert.equal(replyKeyword("START"), "in");
  assert.equal(replyKeyword("stop by at 3?"), null);
});

test("settings fill in defaults", () => {
  assert.equal(settingsWithDefaults({ galleryReady: false }).galleryReady, false);
  assert.equal(settingsWithDefaults(null).sessionReminder, true);
});

test("Twilio signatures match Twilio's documented example", () => {
  // From Twilio's "Validating requests" docs.
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = { CallSid: "CA1234567890ABCDE", Caller: "+12349013030", Digits: "1234", From: "+12349013030", To: "+18005551212" };
  assert.equal(twilioSignature("12345", url, params), "0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
  assert.ok(validTwilioSignature("12345", url, params, "0/KCTR6DLpKmkAf8muzZqo1nDgQ="));
  assert.ok(!validTwilioSignature("12345", url, params, "nope"));
});

test("delivery errors read plainly", () => {
  assert.match(deliveryError(30034), /isn't registered.*\(Twilio error 30034\)/);
  assert.match(deliveryError(12345), /Not delivered\. \(Twilio error 12345\)/);
});
