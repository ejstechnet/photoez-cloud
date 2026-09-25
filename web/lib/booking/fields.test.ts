// Tests for custom booking questions.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAnswers, fieldsForSession, type BookingField } from "./fields.ts";

const outfits: BookingField = { id: "f1", label: "How many outfits?", type: "select", options: ["1", "2", "3"], required: true, sessionTypeIds: [] };
const ideas: BookingField = { id: "f2", label: "Your ideas", type: "textarea", options: [], required: false, sessionTypeIds: [] };
const waiver: BookingField = { id: "f3", label: "I'm 18 or older", type: "checkbox", options: [], required: true, sessionTypeIds: ["boudoir"] };

test("questions follow the sessions they're attached to", () => {
  assert.deepEqual(fieldsForSession([outfits, waiver], "senior").map((f) => f.id), ["f1"]);
  assert.deepEqual(fieldsForSession([outfits, waiver], "boudoir").map((f) => f.id), ["f1", "f3"]);
});

test("valid answers are saved with each question's wording", () => {
  const result = checkAnswers([outfits, ideas, waiver], { f1: "2", f2: "  Gym shots ", f3: "on" });
  assert.deepEqual(result, {
    ok: true,
    answers: [
      { label: "How many outfits?", type: "select", value: "2" },
      { label: "Your ideas", type: "textarea", value: "Gym shots" },
      { label: "I'm 18 or older", type: "checkbox", value: "Yes" },
    ],
  });
});

test("skipped optional questions are left out; unticked boxes say No", () => {
  const result = checkAnswers([ideas, { ...waiver, required: false }], {});
  assert.deepEqual(result, { ok: true, answers: [{ label: "I'm 18 or older", type: "checkbox", value: "No" }] });
});

test("required questions and made-up dropdown choices are refused", () => {
  const result = checkAnswers([outfits, waiver], { f1: "7" });
  assert.deepEqual(result, {
    ok: false,
    errors: { f1: "Choose one of the options.", f3: "Please tick this box to continue." },
  });
  assert.deepEqual(checkAnswers([outfits], {}), { ok: false, errors: { f1: "Please answer this question." } });
});
