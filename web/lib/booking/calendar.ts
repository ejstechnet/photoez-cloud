import { addDays, addMonths, dayOfWeek, type LocalDate } from "./time.ts";

// The month grid for the Bookings calendar: whole weeks, Sunday first, that
// cover the month (4 to 6 rows).

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthGrid(month: string): LocalDate[][] {
  const first = `${month}-01`;
  const next = `${addMonths(month, 1)}-01`;
  let day = addDays(first, -dayOfWeek(first));
  const weeks: LocalDate[][] = [];
  while (day < next) {
    const week: LocalDate[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// "October 2026"
export function monthTitle(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// True when a calendar day falls inside a time-off range (inclusive).
export function inRange(day: LocalDate, start: LocalDate, end: LocalDate) {
  return day >= start && day <= end;
}
