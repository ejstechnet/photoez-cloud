// Time-zone helpers for booking. Availability is stored as wall-clock times
// in the studio's time zone ("09:00" on Tuesdays in America/Los_Angeles);
// bookings are stored as exact instants (UTC). These convert between the two
// using the built-in Intl API, so daylight-saving changes come out right.

export type LocalDate = string; // "2026-10-06"
export type LocalTime = string; // "09:30"

function offsetMinutes(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - instant.getTime()) / 60_000;
}

// The exact instant of a wall-clock time in a time zone.
export function zonedToUtc(date: LocalDate, time: LocalTime, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes settle the offset even right next to a daylight-saving change.
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess - offsetMinutes(new Date(first), timeZone) * 60_000);
}

// The studio-local calendar date of an instant ("2026-10-06").
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

// Day of the week (0 = Sunday) of a calendar date, independent of time zone.
export function dayOfWeek(date: LocalDate) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatTime(instant: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(instant);
}

export function formatDate(instant: Date, timeZone: string, style: "long" | "short" = "long") {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: style === "long" ? "long" : "short",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    year: "numeric",
  }).format(instant);
}

// Short zone name at that instant, e.g. "PDT" or "PST".
export function zoneLabel(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(instant);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

// Month helpers for the booking calendar ("2026-10").
export function addMonths(month: string, months: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
