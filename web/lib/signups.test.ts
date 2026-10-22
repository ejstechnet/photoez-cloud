// The Sign-ups page lists every studio, not just ones from a tagged link.
// Before 2026-10-21 it read only `leads`, so a studio that signed up from a
// plain photoezcloud.com link never showed. Runs against the in-memory
// Postgres (test/db.ts).   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "@/db";
import { leads, photographers } from "@/db/schema";
import { allSignups } from "./signups";

test("sign-ups include untagged studios and leftover addresses, never the owner", async () => {
  process.env.OWNER_EMAILS = "owner@signups.test";
  const now = Date.now();
  const at = (daysAgo: number) => new Date(now - daysAgo * 86_400_000);
  await db.insert(photographers).values([
    { name: "Owner", email: "owner@signups.test", emailVerified: true, createdAt: at(30) },
    { name: "Plain Link", email: "plain@signups.test", emailVerified: false, createdAt: at(1) },
    { name: "Tagged", email: "tagged@signups.test", emailVerified: true, plan: "pro", createdAt: at(2) },
  ]);
  await db.insert(leads).values([
    { email: "tagged@signups.test", source: "facebook", createdAt: at(2) },
    { email: "left@signups.test", source: "join-old", createdAt: at(3) },
  ]);

  const rows = (await allSignups()).filter((r) => r.email.endsWith("@signups.test"));
  assert.deepEqual(
    rows.map((r) => [r.email, r.source, r.hasAccount, r.emailVerified, r.status]),
    [
      ["plain@signups.test", null, true, false, "Free"],
      ["tagged@signups.test", "facebook", true, true, "Pro"],
      ["left@signups.test", "join-old", false, false, "No account"],
    ],
  );
  process.env.OWNER_EMAILS = "";
});
