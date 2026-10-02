// A studio's bookings as an iCalendar feed (RFC 5545), for the private
// calendar link in Settings: Google Calendar, Apple Calendar, and Outlook
// subscribe to it and refresh it on their own. (No database here, so it's
// tested in calendar-feed.test.ts; app/calendar/[token]/route.ts serves it.)

export type FeedEvent = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  updatedAt?: Date | null;
};

// Text values: backslashes, semicolons, commas, and line breaks escaped.
export function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// 20261002T153000Z (UTC).
export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Lines longer than 75 bytes are folded: continued on the next line after a space.
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildCalendar(calendarName: string, events: FeedEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EJS Tech//PhotoEZ Cloud//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(calendarName)}`,
    // Ask calendar apps to check back about hourly (Google decides on its own).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@photoezcloud.com`,
      `DTSTAMP:${icsDate(e.updatedAt ?? now)}`,
      `DTSTART:${icsDate(e.startsAt)}`,
      `DTEND:${icsDate(e.endsAt)}`,
      `SUMMARY:${icsText(e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("STATUS:CONFIRMED", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
