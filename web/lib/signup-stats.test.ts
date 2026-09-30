// Tests for the Sign-ups page's counting and the owner check.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { bySource, csvCell, isOwnerEmail, signupStatus } from "./signup-stats.ts";

test("sign-ups are counted per tag, with how many now pay", () => {
  const tags = bySource([
    { source: "facebook", status: "Pro" },
    { source: "facebook", status: "Pro trial" },
    { source: "fb-grads", status: "Studio" },
    { source: null, status: "Free" },
  ]);
  assert.deepEqual(tags[0], { source: "facebook", signups: 2, paying: 1 });
  assert.equal(tags.find((t) => t.source === "fb-grads")?.paying, 1);
  assert.equal(tags.find((t) => t.source === "(none)")?.signups, 1);
});

test("a sign-up's status: trial, plan, or no account", () => {
  const later = new Date(Date.now() + 5 * 86_400_000);
  assert.equal(signupStatus(null, null), "No account");
  assert.equal(signupStatus("free", later), "Pro trial");
  assert.equal(signupStatus("free", new Date(Date.now() - 86_400_000)), "Free");
  assert.equal(signupStatus("pro", null), "Pro");
  assert.equal(signupStatus("studio", null), "Studio");
});

test("CSV cells are quoted and can't run as spreadsheet formulas", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('Smith, "Jo"'), '"Smith, ""Jo"""');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
});

test("only the owner emails set on the server count as the owner", () => {
  process.env.OWNER_EMAILS = "Owner@Example.com, second@example.com";
  assert.equal(isOwnerEmail("owner@example.com"), true);
  assert.equal(isOwnerEmail(" SECOND@example.com "), true);
  assert.equal(isOwnerEmail("someone@example.com"), false);
  assert.equal(isOwnerEmail(null), false);
  process.env.OWNER_EMAILS = "";
  assert.equal(isOwnerEmail("owner@example.com"), false);
});
