// Tests for the owner's emails to studios: groups, fill-ins, drafts.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDraft,
  fillIn,
  inAudience,
  starterTemplates,
  studioEmailContent,
  unknownFillIns,
  type StudioRow,
} from "./studio-emails.ts";

const NOW = new Date("2026-11-02T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const studio = (o: Partial<StudioRow>): StudioRow => ({
  id: "s1",
  name: "Maria Lopez",
  businessName: "Sunny Day Photo",
  email: "maria@example.com",
  plan: "free",
  trialEndsAt: null,
  emailVerified: true,
  createdAt: new Date(NOW.getTime() - 30 * day),
  optedOut: false,
  ...o,
});

test("each group picks the right studios", () => {
  const trial = studio({ trialEndsAt: new Date(NOW.getTime() + 3 * day) });
  const free = studio({ trialEndsAt: new Date(NOW.getTime() - 3 * day) });
  const pro = studio({ plan: "pro" });
  const fresh = studio({ createdAt: new Date(NOW.getTime() - 2 * day), emailVerified: false });
  assert.deepEqual(
    [trial, free, pro, fresh].map((s) => inAudience(s, "trial", NOW)),
    [true, false, false, false],
  );
  assert.deepEqual(
    [trial, free, pro].map((s) => inAudience(s, "free", NOW)),
    [false, true, false],
  );
  assert.deepEqual(
    [trial, pro].map((s) => inAudience(s, "paying", NOW)),
    [false, true],
  );
  assert.equal(inAudience(fresh, "new", NOW), true);
  assert.equal(inAudience(pro, "new", NOW), false);
  assert.equal(inAudience(fresh, "unconfirmed", NOW), true);
  assert.equal(inAudience(pro, "all", NOW), true);
});

test("fill-ins use each studio's details, with sensible fallbacks", () => {
  const text = "Hi {first_name} ({name}) of {studio_name}, at {email}. {unknown} stays.";
  assert.equal(
    fillIn(text, studio({})),
    "Hi Maria (Maria Lopez) of Sunny Day Photo, at maria@example.com. {unknown} stays.",
  );
  assert.equal(fillIn("{studio_name}", studio({ businessName: null })), "Maria Lopez");
  assert.equal(fillIn("Hi {first_name}", studio({ name: " " })), "Hi there");
  assert.deepEqual(unknownFillIns("Hi {firstname}, {first_name} {oops} {oops}"), ["firstname", "oops"]);
});

test("a draft needs a subject and message, and a button needs both parts", () => {
  const ok = { subject: "Hi", heading: "", body: "Hello", buttonLabel: "", buttonUrl: "" };
  assert.deepEqual(checkDraft(ok), {});
  assert.deepEqual(checkDraft({ ...ok, subject: " ", body: "" }), { subject: "Add a subject.", body: "Write the message." });
  assert.equal(checkDraft({ ...ok, buttonLabel: "Go" }).buttonUrl, "Add the address the button opens, or clear the button text.");
  assert.equal(checkDraft({ ...ok, buttonUrl: "https://x.test" }).buttonLabel, "Add the button text, or clear the address.");
  assert.equal(checkDraft({ ...ok, buttonLabel: "Go", buttonUrl: "photoezcloud.com" }).buttonUrl, "Use a full address starting with https://");
});

test("the email fills in each part and leaves out an empty heading or button", () => {
  const content = studioEmailContent(
    { subject: "Hi {first_name}", heading: "", body: "Hi {first_name},\n\nLine one\nline two", buttonLabel: "", buttonUrl: "" },
    studio({}),
  );
  assert.deepEqual(content, {
    subject: "Hi Maria",
    heading: undefined,
    intro: ["Hi Maria,", "Line one\nline two"],
    button: undefined,
    outro: undefined,
  });
});

test("{button} on its own line puts the button there, so a sign-off can follow", () => {
  const content = studioEmailContent(
    { subject: "Hi", heading: "", body: "Hello\n\n{button}\n\nElle", buttonLabel: "Open it", buttonUrl: "https://x.test" },
    studio({}),
  );
  assert.deepEqual(content.intro, ["Hello"]);
  assert.deepEqual(content.button, { label: "Open it", url: "https://x.test" });
  assert.deepEqual(content.outro, ["Elle"]);
  assert.deepEqual(unknownFillIns("{button}"), []);
});

test("every starter template is ready to send except Blank, which needs a subject", () => {
  for (const t of starterTemplates("https://photoezcloud.com")) {
    assert.deepEqual(unknownFillIns(`${t.subject} ${t.heading} ${t.body}`), [], t.name);
    const errors = checkDraft(t);
    assert.deepEqual(errors, t.name === "Blank" ? { subject: "Add a subject." } : {}, t.name);
  }
});
