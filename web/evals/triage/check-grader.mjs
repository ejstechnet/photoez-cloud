// Free sanity check for the field grader (no API calls): a perfect answer
// built from the expected values must score 100%, and a blank answer must not.
//
//   node evals/triage/check-grader.mjs

import { readFileSync } from "node:fs";
import { checkFields } from "./grader.mjs";

const { cases } = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
const first = (v) => (Array.isArray(v) ? v[0] : v);

function oracle(e) {
  const budget = e.budget ?? {};
  return {
    sessionType: first(e.sessionType),
    clientName: e.clientName,
    phone: e.phone,
    eventDate: first(e.eventDate),
    dateText: e.dateMentioned ? "as written" : null,
    location: e.location === "any" ? null : e.location,
    budgetMin: budget.min ?? (budget.max !== undefined && budget.min === undefined ? null : null),
    budgetMax: budget.max ?? null,
    peopleCount: e.peopleCount ? e.peopleCount[0] : null,
    urgency: e.urgency[0],
  };
}

const blank = {
  sessionType: "other",
  clientName: null,
  phone: null,
  eventDate: null,
  dateText: null,
  location: null,
  budgetMin: null,
  budgetMax: null,
  peopleCount: null,
  urgency: "normal",
};

const mean = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100);
const oracleFields = [], oracleFound = [], blankFields = [], blankFound = [];
for (const c of cases) {
  const o = checkFields(oracle(c.expected), c.expected);
  const b = checkFields(blank, c.expected);
  if (o.fields !== 1) console.log(`ORACLE MISS ${c.id}:`, o.checks);
  oracleFields.push(o.fields);
  blankFields.push(b.fields);
  if (o.found !== null) oracleFound.push(o.found);
  if (b.found !== null) blankFound.push(b.found);
}
console.log(`perfect answers: details right ${mean(oracleFields)}%, details found ${mean(oracleFound)}% (both must be 100%)`);
console.log(`blank answers:   details right ${mean(blankFields)}%, details found ${mean(blankFound)}% (found must be 0%)`);
console.log(`"details found" applies to ${oracleFound.length} of ${cases.length} cases (the rest give no details to find)`);
