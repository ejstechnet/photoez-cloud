// Tests for the booking slot calculator and time-zone helpers.
//   node --test lib/booking/slots.test.ts   (or: npm test)

import assert from "node:assert/strict";
import { test } from "node:test";
import { availableSlots, type SlotRequest } from "./slots.ts";
import { formatTime, zonedToUtc } from "./time.ts";

const TZ = "America/Los_Angeles";
const times = (slots: Date[]) => slots.map((s) => formatTime(s, TZ));

// Tuesday 9:00–12:00, 15-minute buffer. "Now" is the Sunday before.
const base: SlotRequest = {
  date: "2026-10-06",
  timeZone: TZ,
  durationMinutes: 60,
  hours: [{ dayOfWeek: 2, startTime: "09:00", endTime: "12:00", bufferMinutes: 15 }],
  minNoticeDays: 0,
  blackouts: [],
  busy: [],
  now: new Date("2026-10-04T12:00:00Z"),
};

test("steps by session length plus buffer, like the plugin", () => {
  assert.deepEqual(times(availableSlots(base)), ["9:00 AM", "10:15 AM"]);
});

test("a slot must end by closing time", () => {
  const slots = availableSlots({ ...base, durationMinutes: 90 });
  assert.deepEqual(times(slots), ["9:00 AM"]);
});

test("no hours that day means no slots", () => {
  assert.deepEqual(availableSlots({ ...base, date: "2026-10-07" }), []);
});

test("an existing booking blocks overlapping slots, including its buffer", () => {
  // A 2-hour booking 10:00–12:00 blocks 9:00 (it would run into the buffer) and 10:15.
  const busy = [{ startsAt: zonedToUtc("2026-10-06", "10:00", TZ), endsAt: zonedToUtc("2026-10-06", "12:00", TZ) }];
  assert.deepEqual(availableSlots({ ...base, busy }), []);
});

test("a short booking only blocks the slots it touches", () => {
  const busy = [{ startsAt: zonedToUtc("2026-10-06", "10:15", TZ), endsAt: zonedToUtc("2026-10-06", "10:45", TZ) }];
  assert.deepEqual(times(availableSlots({ ...base, busy })), ["9:00 AM"]);
});

test("minimum notice in days", () => {
  assert.deepEqual(availableSlots({ ...base, minNoticeDays: 3 }), []);
  assert.equal(availableSlots({ ...base, minNoticeDays: 2 }).length, 2);
});

test("blackout dates, including ranges", () => {
  assert.deepEqual(availableSlots({ ...base, blackouts: [{ startDate: "2026-10-05", endDate: "2026-10-09" }] }), []);
});

test("slots already in the past today are skipped", () => {
  const now = zonedToUtc("2026-10-06", "09:30", TZ);
  assert.deepEqual(times(availableSlots({ ...base, now })), ["10:15 AM"]);
});

test("times stay correct across the daylight-saving change", () => {
  // Nov 1, 2026: clocks fall back at 2:00 AM. Sunday hours 9–10 AM.
  const hours = [{ dayOfWeek: 0, startTime: "09:00", endTime: "10:00", bufferMinutes: 0 }];
  const before = availableSlots({ ...base, date: "2026-10-25", hours });
  const after = availableSlots({ ...base, date: "2026-11-01", hours });
  assert.deepEqual(times(before), ["9:00 AM"]);
  assert.deepEqual(times(after), ["9:00 AM"]);
  assert.equal(before[0].toISOString(), "2026-10-25T16:00:00.000Z"); // PDT, UTC-7
  assert.equal(after[0].toISOString(), "2026-11-01T17:00:00.000Z"); // PST, UTC-8
});
