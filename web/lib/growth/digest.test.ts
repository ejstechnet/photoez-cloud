// The owner's daily Growth email. Runs against the in-memory Postgres
// (test/db.ts); with no SMTP set up, emails are logged as "skipped".
//   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLog, growthOpportunities, photographers } from "@/db/schema";
import { digestContent, sendGrowthDigest } from "./digest";

// 2026-10-22 in Portland: 7 a.m. and 9 a.m. (UTC-7).
const SEVEN_AM = new Date("2026-10-22T14:00:00Z");
const NINE_AM = new Date("2026-10-22T16:00:00Z");

test("the email lists posts worth a reply with scores and links, then follow-ups", () => {
  const content = digestContent(
    {
      fresh: [
        { id: "p1", title: "Pixieset alternative?", score: 92, tier: "high" },
        { id: "p2", title: "Booking app for minis", score: 61, tier: "review" },
      ],
      followUps: [{ id: "p3", title: "Gallery delivery question", score: 70, tier: "review" }],
      found: 9,
      screened: 5,
    },
    "https://photoezcloud.com",
  );
  assert.equal(content.subject, "Growth: 2 new posts worth a reply");
  assert.deepEqual(content.details?.[0], ["92/100 · High priority", "Pixieset alternative?\nhttps://photoezcloud.com/dashboard/growth/p1"]);
  assert.equal(content.details?.[2]?.[0], "Follow up");
  assert.match(content.intro.join(" "), /9 posts were found or saved; 5 filtered out/);
  assert.match(content.outro?.join(" ") ?? "", /Nothing is ever posted for you/);
});

test("sent once a day after 8 a.m. in the owner's time zone, only with something in it", async () => {
  process.env.OWNER_EMAILS = "owner@growth.test";
  const [owner] = await db
    .insert(photographers)
    .values({ name: "Elle", email: "owner@growth.test", emailVerified: true, timeZone: "America/Los_Angeles" })
    .returning();

  // Nothing found yet: no email, but today counts as done.
  assert.equal(await sendGrowthDigest(SEVEN_AM), "not_yet");
  assert.equal(await sendGrowthDigest(NINE_AM), "empty");
  assert.equal(await sendGrowthDigest(new Date(NINE_AM.getTime() + 3_600_000)), "already");

  // Next day, with a strong new post and a low one (left out).
  const nextDay = new Date(NINE_AM.getTime() + 24 * 3_600_000);
  await db.insert(growthOpportunities).values([
    { url: "https://a.example/1", canonicalUrl: "https://a.example/1", platform: "web", title: "Need galleries + contracts", score: 88, tier: "high", discoveredAt: new Date(nextDay.getTime() - 3_600_000) },
    { url: "https://a.example/2", canonicalUrl: "https://a.example/2", platform: "web", title: "Meh", score: 20, tier: "low", discoveredAt: new Date(nextDay.getTime() - 3_600_000) },
  ]);
  // No SMTP in tests, so the send is "failed" (logged as skipped), and it's
  // still recorded as today's summary.
  assert.equal(await sendGrowthDigest(nextDay), "failed");
  const [logged] = await db.select().from(emailLog).where(eq(emailLog.kind, "growth_digest"));
  assert.equal(logged.photographerId, owner.id);
  assert.equal(logged.subject, "Growth: 1 new post worth a reply");
  assert.match(logged.html, /Need galleries \+ contracts/);
  assert.doesNotMatch(logged.html, /Meh/);
  assert.equal(await sendGrowthDigest(new Date(nextDay.getTime() + 60_000)), "already");
  process.env.OWNER_EMAILS = "";
});
