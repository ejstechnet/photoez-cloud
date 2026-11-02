// The owner's email when a new studio signs up. Runs against the in-memory
// Postgres (test/db.ts); with no SMTP set up, emails are logged as "skipped".
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLog, photographers } from "@/db/schema";
import { newStudioSignup } from "./email/messages";
import { notifyOwnerOfSignup } from "./signup-notice";

test("the email names the studio, how they signed up, and where they came from", () => {
  const content = newStudioSignup({
    name: "Maria Lopez",
    businessName: "Sunny Day Photo",
    email: "maria@example.com",
    withGoogle: false,
    referredBy: "Elle Jones Studios",
    source: "facebook",
    quiz: null,
    trialDays: 14,
    studioCount: 12,
    signupsUrl: "https://photoezcloud.com/dashboard/signups",
  });
  assert.equal(content.subject, "New studio: Maria Lopez (Sunny Day Photo)");
  assert.match(content.intro[0], /started a 14-day Pro trial\. That makes 12 studios\./);
  assert.deepEqual(content.details, [
    ["Name", "Maria Lopez"],
    ["Business", "Sunny Day Photo"],
    ["Email", "maria@example.com"],
    ["Signed up with", "Email and password (not confirmed yet)"],
    ["Referred by", "Elle Jones Studios"],
    ["Came from", "facebook"],
  ]);
  assert.match(content.outro?.join(" ") ?? "", /confirmation link/);

  const google = newStudioSignup({
    name: "Ben",
    businessName: null,
    email: "ben@example.com",
    withGoogle: true,
    referredBy: null,
    source: null,
    quiz: null,
    trialDays: 14,
    studioCount: 13,
    signupsUrl: "https://photoezcloud.com/dashboard/signups",
  });
  assert.equal(google.subject, "New studio: Ben");
  assert.deepEqual(google.details?.slice(1), [
    ["Business", "Not given"],
    ["Email", "ben@example.com"],
    ["Signed up with", "Google"],
    ["Came from", "A plain link (no tag)"],
  ]);
  assert.deepEqual(google.outro, []);
});

test("goes to the owner, names the referrer, and skips the owner's own accounts", async () => {
  process.env.OWNER_EMAILS = "owner@signup-notice.test";
  const [owner] = await db
    .insert(photographers)
    .values({ name: "Elle", email: "owner@signup-notice.test", emailVerified: true })
    .returning();
  const [referrer] = await db
    .insert(photographers)
    .values({ name: "Ref", businessName: "Referring Studio", email: "ref@signup-notice.test", emailVerified: true })
    .returning();
  const [studio] = await db
    .insert(photographers)
    .values({ name: "New Person", email: "new@signup-notice.test", emailVerified: false, referredById: referrer.id })
    .returning();

  await notifyOwnerOfSignup(studio, { source: "quiz-ad", quiz: null });
  // The owner signing up a second account of their own doesn't send one.
  await notifyOwnerOfSignup(owner, { source: null, quiz: null });

  const sent = await db.select().from(emailLog).where(eq(emailLog.kind, "signup_new"));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].photographerId, owner.id);
  assert.equal(sent[0].toEmail, "owner@signup-notice.test");
  assert.equal(sent[0].subject, "New studio: New Person");
  assert.match(sent[0].html, /Referring Studio/);
  assert.match(sent[0].html, /quiz-ad/);
  process.env.OWNER_EMAILS = "";
});
