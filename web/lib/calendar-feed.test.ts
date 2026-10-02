// Tests for the private calendar link's feed.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCalendar, foldLine, icsDate, icsText } from "./calendar-feed.ts";

test("text is escaped the way calendar apps expect", () => {
  assert.equal(icsText("Smith, Jo; family\nsession \\ beach"), "Smith\\, Jo\\; family\\nsession \\\\ beach");
});

test("dates are UTC in the compact form", () => {
  assert.equal(icsDate(new Date("2026-10-02T15:30:00.000Z")), "20261002T153000Z");
});

test("long lines are folded at 75 bytes, never splitting a character", () => {
  const folded = foldLine("DESCRIPTION:" + "é".repeat(80));
  for (const line of folded.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), "DESCRIPTION:" + "é".repeat(80));
});

test("a booking becomes an event with its details", () => {
  const ics = buildCalendar(
    "Bright Studio bookings",
    [
      {
        id: "b1",
        title: "Senior Session · Tina Smith",
        startsAt: new Date("2026-10-10T17:00:00Z"),
        endsAt: new Date("2026-10-10T18:00:00Z"),
        location: "Laurelhurst Park, Portland",
        description: "Phone: 555-0100",
        url: "https://photoezcloud.com/dashboard/bookings/b1",
      },
    ],
    new Date("2026-10-02T00:00:00Z"),
  );
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /X-WR-CALNAME:Bright Studio bookings\r\n/);
  assert.match(ics, /UID:b1@photoezcloud.com\r\n/);
  assert.match(ics, /DTSTART:20261010T170000Z\r\n/);
  assert.match(ics, /SUMMARY:Senior Session · Tina Smith\r\n/);
  assert.match(ics, /LOCATION:Laurelhurst Park\\, Portland\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
