"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bookings, signedContracts } from "@/db/schema";
import { isOverlapError, loadRules, slotsForDate } from "@/lib/booking/availability";
import { findClientBooking } from "@/lib/booking/client-booking";
import { contractTemplateFor, filledContract, signedContractFor } from "@/lib/contracts/for-booking";
import { clientOptions } from "@/lib/booking/policy";
import { localDateOf } from "@/lib/booking/time";
import { issueCredit } from "@/lib/credits";
import { amountPaid } from "@/lib/payments/amounts";
import { bookingPayments } from "@/lib/payments/checkout";

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

  const cancelled = await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: "client", creditDue: options.cancel.creditDue })
    .where(and(eq(bookings.id, booking.id), eq(bookings.status, "confirmed")))
    .returning({ id: bookings.id });

  // Early enough for a credit: everything they paid (online, plus any credit
  // they'd used) becomes a session credit for a future booking.
  if (cancelled.length > 0 && options.cancel.creditDue) {
    const paidOnline = amountPaid(await bookingPayments(booking.id));
    await db.update(bookings).set({ creditCents: 0 }).where(eq(bookings.id, booking.id));
    await issueCredit({
      photographerId: booking.photographerId,
      clientEmail: booking.clientEmail,
      clientName: booking.clientName,
      amountCents: paidOnline + booking.creditCents,
      reason: "Cancelled early",
      sourceBookingId: booking.id,
    });
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/studio/[slug]", "layout");
  redirect(`/booking/${token}?changed=cancelled`);
}

// ---- Signing the contract ----

export type SignState = { message?: string };

const MAX_DRAWN_SIGNATURE = 400_000; // characters of PNG data URL

export async function signContract(
  token: string,
  input: { signerName: string; type: "draw" | "type"; data: string; agreed: boolean },
): Promise<SignState> {
  const found = await findClientBooking(token);
  if (!found) return { message: "This booking link isn't valid anymore." };
  const { booking } = found;
  if (booking.status === "cancelled") return { message: "This booking was cancelled." };
  if (await signedContractFor(booking.id)) return { message: "This contract is already signed." };

  const signerName = input.signerName.trim();
  if (signerName.length < 2 || signerName.length > 120) return { message: "Type your full legal name." };
  if (!input.agreed) return { message: "Tick the box to confirm you've read and agree to the contract." };
  if (input.type === "draw") {
    if (!input.data.startsWith("data:image/png;base64,") || input.data.length > MAX_DRAWN_SIGNATURE) {
      return { message: "Please draw your signature again." };
    }
  } else if (input.type !== "type") {
    return { message: "Please sign again." };
  }

  // Built again here from the booking, never taken from the page.
  const template = await contractTemplateFor(booking);
  if (!template) return { message: "There's no contract to sign for this booking." };
  const content = await filledContract(booking, template);

  const head = await headers();
  try {
    await db.insert(signedContracts).values({
      bookingId: booking.id,
      templateId: template.id,
      title: template.title,
      content,
      signerName,
      signatureType: input.type,
      signatureData: input.type === "draw" ? input.data : signerName,
      clientIp: head.get("x-forwarded-for")?.split(",")[0].trim() ?? head.get("x-real-ip") ?? null,
      userAgent: head.get("user-agent")?.slice(0, 500) ?? null,
    });
  } catch {
    // Two signings at once: the one-per-booking rule keeps only the first.
    if (await signedContractFor(booking.id)) return { message: "This contract is already signed." };
    throw new Error("The signature couldn't be saved.");
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/booking/${token}/contract?signed=1`);
}
