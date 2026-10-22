// Checking the AI's scores and drafted replies.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { enforceReplyRules, quoteInPost, recencyFor, scoreCriteria } from "./score.ts";

const post = `Anyone moved off Pixieset? The fees are killing me and I still need a separate app for contracts.
Shooting mostly seniors and families. Any recommendations?`;

test("quotes count only when they're really in the post", () => {
  assert.equal(quoteInPost("Any recommendations?", post), true);
  assert.equal(quoteInPost("“the fees are killing me”", post), true);
  assert.equal(quoteInPost("I still need a separate app…", post), true);
  assert.equal(quoteInPost("ready to buy today", post), false);
  assert.equal(quoteInPost("a", post), false);
});

test("recency comes from the post's date, not the AI", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  assert.deepEqual(recencyFor(new Date("2026-10-21T09:00:00Z"), now), { points: 15, evidence: "Posted yesterday" });
  assert.equal(recencyFor(new Date("2026-10-17T12:00:00Z"), now).points, 12);
  assert.equal(recencyFor(new Date("2026-10-10T12:00:00Z"), now).points, 8);
  assert.equal(recencyFor(new Date("2026-09-30T12:00:00Z"), now).points, 4);
  assert.equal(recencyFor(new Date("2026-08-01T12:00:00Z"), now).points, 0);
  assert.deepEqual(recencyFor(null, now), { points: 8, evidence: "Post date unknown (half marks)" });
});

test("code adds up the score, caps each part, and zeroes made-up evidence", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const { criteria, total } = scoreCriteria(
    {
      buying_intent: { points: 28, evidence: "Anyone moved off Pixieset?" },
      solvable_problem: { points: 99, evidence: "I still need a separate app for contracts" },
      // Not in the post: the AI imagined it.
      fit: { points: 18, evidence: "I run a busy wedding studio" },
      engagement_path: { points: 9.6, evidence: "Any recommendations?" },
    },
    post,
    new Date("2026-10-21T12:00:00Z"),
    now,
  );
  assert.equal(criteria.buying_intent.points, 28);
  assert.equal(criteria.solvable_problem.points, 25);
  assert.equal(criteria.fit.points, 0);
  assert.match(criteria.fit.evidence, /Quote not found/);
  assert.equal(criteria.engagement_path.points, 10);
  assert.equal(criteria.recency.points, 15);
  assert.equal(total, 28 + 25 + 0 + 10 + 15);
});

test("replies drop links where links aren't allowed, and always say who's writing", () => {
  const rules = { linksAllowed: false, disclosure: "I make PhotoEZ Cloud, so I'm biased." };
  const out = enforceReplyRules("Try PhotoEZ Cloud (https://photoezcloud.com/join?src=fb). It does proofing and contracts.", rules);
  assert.ok(!/https?:|photoezcloud\.com/i.test(out), out);
  assert.match(out, /Try PhotoEZ Cloud/);
  assert.ok(out.endsWith("I make PhotoEZ Cloud, so I'm biased."));

  // Already disclosed in its own words: nothing added.
  const own = enforceReplyRules("Full disclosure, I built PhotoEZ Cloud for exactly this.", rules);
  assert.equal(own, "Full disclosure, I built PhotoEZ Cloud for exactly this.");

  // No product mentioned (just helpful advice): no disclosure needed.
  assert.equal(enforceReplyRules("Look for one app that does contracts and galleries.", rules), "Look for one app that does contracts and galleries.");

  // Links allowed: kept.
  const linked = enforceReplyRules("See https://photoezcloud.com", { linksAllowed: true, disclosure: "I make PhotoEZ Cloud." });
  assert.match(linked, /https:\/\/photoezcloud\.com/);
  assert.match(linked, /I make PhotoEZ Cloud\.$/);
});
