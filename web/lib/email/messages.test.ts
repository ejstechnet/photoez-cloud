// Tests for email wording and rendering.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { paragraphHtml, renderEmail, toParagraphs } from "./layout.ts";
import {
  balanceReminderClient,
  bookingCancelledClient,
  bookingConfirmedClient,
  firstName,
  inquiryReplyClient,
  newInquiryStudio,
  type BookingFacts,
} from "./messages.ts";

const booking: BookingFacts = {
  studioName: "Elle Jones Studios",
  clientName: "Jasmine Lee",
  sessionName: "Family Session",
  when: "Saturday, October 3, 2026 at 10:00 AM PDT",
  length: "1 hr",
  addons: ["Extra edited photos × 5"],
  totalCents: 32500,
  paidCents: 10000,
  manageUrl: "https://photoezcloud.com/booking/abc",
  contractUrl: null,
};
const footer = { studioName: "Elle Jones Studios", footer: "Sent by Elle Jones Studios." };

test("client text is escaped, never treated as HTML", () => {
  const html = renderEmail(
    inquiryReplyClient("Studio <b>", 'Hi <script>alert("x")</script>\n\nThanks & bye'),
    { studioName: "A <i>Studio</i>", footer: "x" },
  ).html;
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("A &lt;i&gt;Studio&lt;/i&gt;"));
  assert.ok(html.includes("Thanks &amp; bye"));
});

test("links in text become clickable, without trailing punctuation", () => {
  const html = paragraphHtml("Book here: https://photoezcloud.com/studio/elle.");
  assert.ok(html.includes('<a href="https://photoezcloud.com/studio/elle"'));
  assert.ok(html.endsWith("</a>."));
});

test("an AI reply keeps its paragraphs", () => {
  assert.deepEqual(toParagraphs("Hi Sam,\r\n\r\nThanks!\nElle\n\n\n"), ["Hi Sam,", "Thanks!\nElle"]);
  assert.equal(inquiryReplyClient("Elle Jones Studios", "One\n\nTwo").intro.length, 2);
});

test("confirmation shows the balance and links to the booking", () => {
  const email = bookingConfirmedClient(booking);
  assert.match(email.subject, /confirmed/);
  assert.deepEqual(
    email.details?.find(([label]) => label === "Balance"),
    ["Balance", "$225"],
  );
  assert.equal(email.button?.url, booking.manageUrl);
});

test("a contract to sign becomes the main button", () => {
  const email = bookingConfirmedClient({ ...booking, contractUrl: `${booking.manageUrl}/contract` });
  assert.equal(email.button?.label, "Sign your contract");
});

test("cancellation explains a credit, a late cancel, or a studio cancel", () => {
  const credit = bookingCancelledClient(booking, {
    by: "client",
    creditCents: 10000,
    creditExpires: "Friday, October 1, 2027",
    lateNoCredit: false,
    noticeHours: 72,
  });
  assert.ok(credit.outro?.some((p) => p.includes("$100") && p.includes("October 1, 2027")));

  const late = bookingCancelledClient(booking, { by: "client", creditCents: 0, creditExpires: null, lateNoCredit: true, noticeHours: 72 });
  assert.ok(late.outro?.some((p) => p.includes("less than 72 hours")));

  const studio = bookingCancelledClient(booking, { by: "studio", creditCents: 0, creditExpires: null, lateNoCredit: false, noticeHours: 72 });
  assert.match(studio.intro[0], /Elle Jones Studios has cancelled/);
});

test("balance reminder asks for what's left", () => {
  const email = balanceReminderClient(booking, booking.manageUrl);
  assert.equal(email.button?.label, "Pay $225");
});

test("new inquiry notice says whether it needs the photographer", () => {
  const base = { fromName: "Sam", fromEmail: "sam@example.com", summary: null, message: "Hi", dashboardUrl: "u" };
  assert.match(newInquiryStudio({ ...base, needsYou: "Asks for a quote", autoSent: false }).subject, /^Needs you/);
  assert.match(newInquiryStudio({ ...base, needsYou: null, autoSent: true }).intro[1], /sent automatically/);
});

test("plain-text version carries the button link", () => {
  const { text } = renderEmail(bookingConfirmedClient(booking), footer);
  assert.ok(text.includes(`View my booking: ${booking.manageUrl}`));
  assert.equal(firstName("  Jasmine Lee "), "Jasmine");
});

test("the studio's logo sits in the header; no logo means just the name", () => {
  const withLogo = renderEmail(bookingConfirmedClient(booking), {
    ...footer,
    logo: { url: "https://photoezcloud.com/email-logo/abc", background: "#ffffff" },
  }).html;
  assert.ok(withLogo.includes('<img src="https://photoezcloud.com/email-logo/abc"'));
  assert.ok(withLogo.includes("background:#ffffff"));

  const clear = renderEmail(bookingConfirmedClient(booking), {
    ...footer,
    logo: { url: "https://photoezcloud.com/email-logo/abc", background: "transparent" },
  }).html;
  assert.ok(!clear.includes("border-radius:12px;padding:8px"));

  // A bad color can't sneak styles into the email.
  const odd = renderEmail(bookingConfirmedClient(booking), {
    ...footer,
    logo: { url: "u", background: "red;position:fixed" },
  }).html;
  assert.ok(!odd.includes("position:fixed"));

  assert.ok(!renderEmail(bookingConfirmedClient(booking), footer).html.includes("<img"));
});
