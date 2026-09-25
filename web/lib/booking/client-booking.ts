import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, photographers, sessionTypes } from "@/db/schema";
import type { ChangePolicy } from "./policy";

// Loads a booking by the private link a client gets after booking, with the
// studio details and self-service rules their booking pages need.
export async function findClientBooking(token: string) {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const [row] = await db
    .select({
      booking: bookings,
      location: sessionTypes.location,
      studioName: photographers.name,
      businessName: photographers.businessName,
      slug: photographers.studioSlug,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
      timeZone: photographers.timeZone,
      enabled: photographers.clientChangesEnabled,
      rescheduleNoticeHours: photographers.rescheduleNoticeHours,
      freeReschedules: photographers.freeReschedules,
      cancelNoticeHours: photographers.cancelNoticeHours,
    })
    .from(bookings)
    .innerJoin(photographers, eq(photographers.id, bookings.photographerId))
    .leftJoin(sessionTypes, eq(sessionTypes.id, bookings.sessionTypeId))
    .where(eq(bookings.manageToken, token));
  if (!row) return null;
  const policy: ChangePolicy = {
    enabled: row.enabled,
    rescheduleNoticeHours: row.rescheduleNoticeHours,
    freeReschedules: row.freeReschedules,
    cancelNoticeHours: row.cancelNoticeHours,
  };
  return { ...row, name: row.businessName ?? row.studioName, policy };
}

// The studio's rules in plain words, shown to the client.
export function describePolicy(policy: ChangePolicy, depositPercent: number) {
  const times = policy.freeReschedules === 1 ? "once" : `up to ${policy.freeReschedules} times`;
  return [
    policy.freeReschedules > 0
      ? `You can reschedule online ${times} for free, up to ${policy.rescheduleNoticeHours} hours before your session.`
      : null,
    depositPercent > 0
      ? `If you cancel more than ${policy.cancelNoticeHours} hours before your session, your deposit becomes a credit toward a future session. Cancellations after that are non-refundable.`
      : null,
  ].filter((line): line is string => line !== null);
}
