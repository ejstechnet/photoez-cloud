"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { isOverlapError, loadRules, slotsForDate } from "@/lib/booking/availability";
import { findClientBooking } from "@/lib/booking/client-booking";
import { clientOptions } from "@/lib/booking/policy";
import { localDateOf } from "@/lib/booking/time";

// Client self-service from the private booking link. The link's token is the
// only key, so every action re-checks the studio's rules on the server; the
// buttons on the page are a convenience, not the gate.

export type ChangeState = { message?: string; taken?: boolean };

export async function rescheduleBooking(token: string, startsAtIso: string): Promise<ChangeState> {
  const found = await findClientBooking(token);
  if (!found) return { message: "This booking link isn't valid anymore." };
  const { booking, policy } = found;
  const now = new Date();
  if (!clientOptions(booking, policy, now).reschedule.allowed) {
    return { message: "This booking can't be rescheduled online anymore. Please contact the studio." };
  }

  // The new time must be one the calendar offers right now, for the same length.
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return { taken: true };
  const minutes = Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000);
  const rules = await loadRules(booking.photographerId);
  const open = await slotsForDate(rules, minutes, localDateOf(startsAt, rules.timeZone), now, booking.id);
  if (!open.some((slot) => slot.getTime() === startsAt.getTime())) return { taken: true };

  try {
    const updated = await db
      .update(bookings)
      .set({
        startsAt,
        endsAt: new Date(startsAt.getTime() + minutes * 60_000),
        rescheduleCount: booking.rescheduleCount + 1,
      })
      // Only if nothing changed since the page loaded (e.g. a second tab).
      .where(
        and(
          eq(bookings.id, booking.id),
          eq(bookings.status, "confirmed"),
          eq(bookings.rescheduleCount, booking.rescheduleCount),
        ),
      )
      .returning({ id: bookings.id });
    if (updated.length === 0) return { message: "This booking just changed. Please reload the page." };
  } catch (error) {
    if (isOverlapError(error)) return { taken: true };
    throw error;
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/booking/${token}?changed=rescheduled`);
}

export async function cancelBooking(token: string): Promise<ChangeState> {
  const found = await findClientBooking(token);
  if (!found) return { message: "This booking link isn't valid anymore." };
  const { booking, policy } = found;
  const options = clientOptions(booking, policy, new Date());
  if (!options.cancel.allowed) {
    return { message: "This booking can't be cancelled online. Please contact the studio." };
  }

  await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: "client", creditDue: options.cancel.creditDue })
    .where(and(eq(bookings.id, booking.id), eq(bookings.status, "confirmed")));

  revalidatePath("/dashboard", "layout");
  revalidatePath("/studio/[slug]", "layout");
  redirect(`/booking/${token}?changed=cancelled`);
}
