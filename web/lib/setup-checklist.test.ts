// The dashboard's welcome checklist (setup-checklist.ts).   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { setupSteps, showSetupChecklist, type SetupFacts } from "./setup-checklist.ts";

const brandNew: SetupFacts = {
  studioSlug: null,
  hasPicture: false,
  stripeReady: false,
  sessionCount: 0,
  hoursCount: 0,
  galleryCount: 0,
  linkCopied: false,
  clientFound: false,
};
const done = (f: SetupFacts) => Object.fromEntries(setupSteps(f).map((s) => [s.key, s.done]));

test("a brand-new studio has all six steps to do, in order", () => {
  const steps = setupSteps(brandNew);
  assert.deepEqual(
    steps.map((s) => s.key),
    ["studio", "stripe", "session", "hours", "gallery", "share"],
  );
  assert.ok(steps.every((s) => !s.done));
  assert.equal(showSetupChecklist(steps, false), true);
});

test("the studio page needs both a web address and a logo or headshot", () => {
  assert.equal(done({ ...brandNew, studioSlug: "jane-photo" }).studio, false);
  assert.equal(done({ ...brandNew, hasPicture: true }).studio, false);
  assert.equal(done({ ...brandNew, studioSlug: "jane-photo", hasPicture: true }).studio, true);
});

test("each other step ticks itself off from what the studio has", () => {
  const d = done({ ...brandNew, stripeReady: true, sessionCount: 1, hoursCount: 5, galleryCount: 2 });
  assert.deepEqual([d.stripe, d.session, d.hours, d.gallery], [true, true, true, true]);
});

test("sharing counts once the link is copied, or once a client has found them", () => {
  assert.equal(done({ ...brandNew, linkCopied: true }).share, true);
  assert.equal(done({ ...brandNew, clientFound: true }).share, true);
});

test("the share step points to the studio page once there is one", () => {
  const before = setupSteps(brandNew).find((s) => s.key === "share")!;
  const after = setupSteps({ ...brandNew, studioSlug: "jane-photo" }).find((s) => s.key === "share")!;
  assert.equal(before.href, "/dashboard/settings#studio");
  assert.equal(after.href, "/studio/jane-photo");
});

test("the card goes away when everything is done, or when hidden", () => {
  const all: SetupFacts = { ...brandNew, studioSlug: "jane-photo", hasPicture: true, stripeReady: true, sessionCount: 1, hoursCount: 1, galleryCount: 1, linkCopied: true, clientFound: false };
  assert.equal(showSetupChecklist(setupSteps(all), false), false);
  assert.equal(showSetupChecklist(setupSteps(brandNew), true), false);
});
