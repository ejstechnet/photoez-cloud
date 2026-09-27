import { addMonths, localDateOf, zonedToUtc } from "./booking/time.ts";

// The time ranges the dashboard's revenue can show, by the studio's own
// calendar (a payment at 11 pm on the 31st in Portland counts for that month).

export const PERIODS = ["month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  month: "This month",
  year: "This year",
  all: "All time",
};

export function parsePeriod(value: unknown): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "month";
}

// When the period starts (null = all time).
export function periodStart(period: Period, now: Date, timeZone: string): Date | null {
  if (period === "all") return null;
  const today = localDateOf(now, timeZone); // "2026-09-26"
  const first = period === "month" ? `${today.slice(0, 7)}-01` : `${today.slice(0, 4)}-01-01`;
  return zonedToUtc(first, "00:00", timeZone);
}

// The current calendar month, start and end, for "sessions this month".
export function monthRange(now: Date, timeZone: string) {
  const month = localDateOf(now, timeZone).slice(0, 7);
  return {
    start: zonedToUtc(`${month}-01`, "00:00", timeZone),
    end: zonedToUtc(`${addMonths(month, 1)}-01`, "00:00", timeZone),
  };
}
