import type { BookingStatus } from "./status.ts";

// What a client may change from their booking link, under the studio's rules.
// Pure logic (no database), tested in policy.test.ts.

export type ChangePolicy = {
  enabled: boolean;
  rescheduleNoticeHours: number;
  freeReschedules: number;
  // Cancelling more than this many hours ahead turns the deposit into a credit.
  cancelNoticeHours: number;
};

export type ClientBooking = {
  status: BookingStatus;
  startsAt: Date;
  rescheduleCount: number;
  depositPercent: number;
};

// Why a change can't be made online (the page then says to contact the studio).
export type Blocked = "not_active" | "turned_off" | "too_late" | "limit_reached";

export type ClientOptions = {
  reschedule: { allowed: true } | { allowed: false; reason: Blocked };
  cancel: { allowed: true; creditDue: boolean } | { allowed: false; reason: Blocked };
};

const HOUR = 3_600_000;

export function clientOptions(booking: ClientBooking, policy: ChangePolicy, now: Date): ClientOptions {
  const hoursLeft = (booking.startsAt.getTime() - now.getTime()) / HOUR;

  if (booking.status !== "confirmed" || hoursLeft <= 0) {
    return { reschedule: { allowed: false, reason: "not_active" }, cancel: { allowed: false, reason: "not_active" } };
  }
  if (!policy.enabled) {
    return { reschedule: { allowed: false, reason: "turned_off" }, cancel: { allowed: false, reason: "turned_off" } };
  }

  const reschedule: ClientOptions["reschedule"] =
    hoursLeft < policy.rescheduleNoticeHours
      ? { allowed: false, reason: "too_late" }
      : booking.rescheduleCount >= policy.freeReschedules
        ? { allowed: false, reason: "limit_reached" }
        : { allowed: true };

  // Cancelling is always possible while the session is upcoming; the notice
  // only decides whether the deposit carries over as a credit.
  const creditDue = booking.depositPercent > 0 && hoursLeft > policy.cancelNoticeHours;
  return { reschedule, cancel: { allowed: true, creditDue } };
}
