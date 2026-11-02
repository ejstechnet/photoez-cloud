// Sending the owner's emails to studios. Runs against the in-memory Postgres
// (test/db.ts); with no SMTP set up, emails are logged as "skipped", so each
// studio's row ends up "failed" here (on the server they're "sent").
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLog, photographers, studioEmailRecipients, studioEmailSends, studioEmailTemplates } from "@/db/schema";
import { createSend, ensureStarterTemplates, listStudios, processSend, sendHistory } from "./studio-emails-server";

const draft = {
  subject: "Hi {first_name}",
  heading: "",
  body: "Hello {studio_name}!",
  buttonLabel: "",
  buttonUrl: "",
};

test("sends to the chosen studios, never the owner or anyone who unsubscribed", async () => {
  process.env.OWNER_EMAILS = "owner@studio-emails.test";
  process.env.BETTER_AUTH_SECRET ??= "test secret";
  const [owner] = await db
    .insert(photographers)
    .values({ name: "Elle Jones", email: "owner@studio-emails.test", emailVerified: true })
    .returning();
  const [maria, ben, gone, later] = await db
    .insert(photographers)
    .values([
      { name: "Maria Lopez", businessName: "Sunny Day Photo", email: "maria@studio-emails.test", emailVerified: true },
      { name: "Ben", email: "ben@studio-emails.test", emailVerified: true },
      { name: "Gone", email: "gone@studio-emails.test", emailVerified: true, marketingOptOutAt: new Date() },
      { name: "Later", email: "later@studio-emails.test", emailVerified: true },
    ])
    .returning();

  // The owner isn't on the list; the unsubscribed studio is, marked as such.
  const listed = await listStudios();
  assert.equal(listed.some((s) => s.id === owner.id), false);
  assert.equal(listed.find((s) => s.id === gone.id)?.optedOut, true);

  const created = await createSend(draft, [maria.id, ben.id, gone.id, owner.id, later.id, maria.id], null);
  assert.equal(created?.count, 3);

  // "Later" unsubscribes after the send was saved, before it goes out.
  await db.update(photographers).set({ marketingOptOutAt: new Date() }).where(eq(photographers.id, later.id));
  await processSend(created!.sendId, 0);

  const rows = await db.select().from(studioEmailRecipients).where(eq(studioEmailRecipients.sendId, created!.sendId));
  const status = Object.fromEntries(rows.map((r) => [r.email, r.status]));
  assert.deepEqual(status, {
    "maria@studio-emails.test": "failed",
    "ben@studio-emails.test": "failed",
    "later@studio-emails.test": "skipped",
  });

  // Each email has the studio's own fill-ins, sits in the owner's Email log,
  // and carries the studio's unsubscribe link and the PhotoEZ Cloud logo.
  const logged = await db.select().from(emailLog).where(eq(emailLog.kind, "studio_email"));
  const toMaria = logged.find((l) => l.toEmail === "maria@studio-emails.test")!;
  assert.equal(toMaria.photographerId, owner.id);
  assert.equal(toMaria.subject, "Hi Maria");
  assert.match(toMaria.html, /Hello Sunny Day Photo!/);
  assert.match(toMaria.html, new RegExp(`/unsubscribe/${maria.id}\\.`));
  assert.match(toMaria.html, /photoez-cloud-logo-email\.png/);

  const [send] = await db.select().from(studioEmailSends).where(eq(studioEmailSends.id, created!.sendId));
  assert.equal(send.status, "done");
  const [history] = await sendHistory();
  assert.deepEqual([history.total, history.failed, history.skipped, history.pending], [3, 2, 1, 0]);

  // Nobody left to send to: nothing is saved.
  assert.equal(await createSend(draft, [gone.id, owner.id], null), null);
  process.env.OWNER_EMAILS = "";
});

test("the starter templates arrive once, and not again after a send", async () => {
  await db.delete(studioEmailSends);
  await ensureStarterTemplates();
  await ensureStarterTemplates();
  const names = (await db.select({ name: studioEmailTemplates.name }).from(studioEmailTemplates)).map((t) => t.name);
  assert.deepEqual(names, ["Welcome", "Trial check-in", "Trial ending soon", "New feature announcement", "Tips & how-tos", "Blank"]);
});
