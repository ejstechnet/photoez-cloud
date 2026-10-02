// Tests for the landing-page quiz.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { answersFromCookieHeader, cleanAnswers, decodeAnswers, describeAnswers, encodeAnswers, quizResult } from "./quiz.ts";

const sample = { shoots: ["weddings", "portraits"], tools: ["honeybook", "pixieset", "manual"], headache: "delivery", volume: "5-10" };

test("answers survive the cookie round trip; unknown ones are dropped", () => {
  assert.deepEqual(decodeAnswers(encodeAnswers(sample)), sample);
  assert.deepEqual(cleanAnswers({ ...sample, shoots: ["weddings", "<script>"], headache: "nope" })?.shoots, ["weddings"]);
  assert.equal(cleanAnswers({ ...sample, headache: "nope" })?.headache, "");
  assert.equal(cleanAnswers({}), null);
  assert.equal(decodeAnswers("garbage"), null);
});

test("the cookie is read from a request's cookies", () => {
  const header = `a=1; pez_quiz=${encodeURIComponent(encodeAnswers(sample))}; b=2`;
  assert.deepEqual(answersFromCookieHeader(header), sample);
  assert.equal(answersFromCookieHeader("a=1"), null);
  assert.equal(answersFromCookieHeader("pez_quiz=%E0%A4%A"), null);
});

test("the result: tools replaced, savings, and the plan that fits", () => {
  const r = quizResult(sample);
  assert.equal(r.plan, "pro");
  assert.deepEqual(r.replaced.map((t) => t.id), ["honeybook", "pixieset"]);
  assert.equal(r.currentCents, 4500);
  assert.equal(r.savingsCents, 4500 - r.planCents);
  assert.match(r.answer, /favorite/);
  assert.equal(quizResult({ ...sample, volume: "20+" }).plan, "studio");
  assert.equal(quizResult({ ...sample, volume: "11-20" }).plan, "studio");
  assert.equal(quizResult({ ...sample, shoots: ["portraits"], volume: "11-20" }).plan, "pro");
  // No savings shown below zero.
  assert.equal(quizResult({ ...sample, tools: ["manual"] }).savingsCents, 0);
});

test("answers read back in plain words", () => {
  assert.match(describeAnswers(sample), /Weddings & elopements/);
  assert.match(describeAnswers(sample), /5–10 sessions a month/);
});
