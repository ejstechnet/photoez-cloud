// Available time slots for one photographer on one day. Pure logic (no
// database), so it can be tested directly: see slots.test.ts.
//
// Same rules as PhotoEZ Booking for WordPress: the photographer's weekly
// hours for that day, minimum notice in days, blackout dates, and slots that
// step by session length + buffer from the start of the day. One change: a
// slot conflicts with an existing booking using that booking's real start
// and end (the plugin compared against the new session's length), with the
// buffer kept clear on both sides.

import { addDays, dayOfWeek, localDateOf, zonedToUtc, type LocalDate, type LocalTime } from "./time.ts";

export type WeeklyHours = { dayOfWeek: number; startTime: LocalTime; endTime: LocalTime; bufferMinutes: number };
export type Blackout = { startDate: LocalDate; endDate: LocalDate };
export type Busy = { startsAt: Date; endsAt: Date };

export type SlotRequest = {
  date: LocalDate;
  timeZone: string;
  durationMinutes: number;
  hours: WeeklyHours[];
  minNoticeDays: number;
  blackouts: Blackout[];
  busy: Busy[];
  now: Date;
};

export function availableSlots(req: SlotRequest): Date[] {
  const today = localDateOf(req.now, req.timeZone);
  if (req.date < addDays(today, req.minNoticeDays)) return [];
  if (req.blackouts.some((b) => req.date >= b.startDate && req.date <= b.endDate)) return [];

  const rule = req.hours.find((h) => h.dayOfWeek === dayOfWeek(req.date));
  if (!rule || req.durationMinutes <= 0) return [];

  const dayStart = zonedToUtc(req.date, rule.startTime, req.timeZone).getTime();
  const dayEnd = zonedToUtc(req.date, rule.endTime, req.timeZone).getTime();
  const length = req.durationMinutes * 60_000;
  const buffer = rule.bufferMinutes * 60_000;
  const step = length + buffer;

  const slots: Date[] = [];
  for (let start = dayStart; start + length <= dayEnd; start += step) {
    const end = start + length;
    if (start <= req.now.getTime()) continue;
    const clashes = req.busy.some(
      (b) => start < b.endsAt.getTime() + buffer && end + buffer > b.startsAt.getTime(),
    );
    if (!clashes) slots.push(new Date(start));
  }
  return slots;
}
