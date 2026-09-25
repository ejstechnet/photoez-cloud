"use server";

import { randomBytes } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { bookingAddons, bookings, clients, photographers, sessionTypes } from "@/db/schema";
import { pickAddons } from "@/lib/booking/addons";
import { isOverlapError, loadRules, slotsForDate } from "@/lib/booking/availability";
import { offeredAddons } from "@/lib/booking/session-addons";
import { localDateOf } from "@/lib/booking/time";

// The public "Book" button. Anyone can call this, so it re-checks everything
// the page showed: the session is bookable, the time is still open, and the
// same email isn't flooding the calendar. The database's no-overlap rule is
// the final guard if two clients book the same time at the same moment.

const MAX_PER_EMAIL_PER_HOUR = 3;

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "Keep your name under 120 characters."),
  email: z.email("Enter a valid email address.").trim().max(254),
  phone: z
    .string()
    .trim()
    .max(40, "Keep the phone number under 40 characters.")
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(2000, "Keep notes under 2,000 characters.")
    .transform((v) => v || null),
});

export type BookingFormState = {
  errors?: Partial<Record<keyof z.input<typeof formSchema>, string>>;
  message?: string;
  // The chosen time is gone: send the client back to pick another.
  taken?: boolean;
};

export async function createBooking(
  slug: string,
  sessionTypeId: string,
  startsAtIso: string,
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  if (String(formData.get("website") ?? "") !== "") return { message: "Something went wrong. Please try again." };

  const parsed = formSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    const errors: BookingFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as keyof z.input<typeof formSchema>] ??= issue.message;
    }
    return { errors };
  }
  const data = parsed.data;

  const [studio] = await db
    .select({ id: photographers.id })
    .from(photographers)
    .where(eq(photographers.studioSlug, slug));
  if (!studio || !z.uuid().safeParse(sessionTypeId).success) return { message: "This session can't be booked anymore." };

  const [session] = await db
    .select()
    .from(sessionTypes)
    .where(
      and(
        eq(sessionTypes.id, sessionTypeId),
        eq(sessionTypes.photographerId, studio.id),
        eq(sessionTypes.hidden, false),
      ),
    );
  if (!session) return { message: "This session can't be booked anymore." };

  // Only times the calendar would offer right now are accepted.
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return { taken: true };
  const rules = await loadRules(studio.id);
  const open = await slotsForDate(rules, session.durationMinutes, localDateOf(startsAt, rules.timeZone));
  if (!open.some((slot) => slot.getTime() === startsAt.getTime())) return { taken: true };

  const [{ recent }] = await db
    .select({ recent: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.photographerId, studio.id),
        sql`lower(${bookings.clientEmail}) = lower(${data.email})`,
        gt(bookings.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    );
  if (recent >= MAX_PER_EMAIL_PER_HOUR) {
    return { message: "You've made several bookings in the last hour. Please contact the studio to book more." };
  }

  // Extras: the form sends addon.<id> = quantity; only this session's add-ons,
  // within their limits, are accepted.
  const picked: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("addon.")) picked[key.slice("addon.".length)] = Number(value);
  }
  const extras = pickAddons(await offeredAddons(session.id), picked);
  if (!extras.ok) return { message: extras.message };

  const manageToken = randomBytes(24).toString("base64url");
  try {
    await db.transaction(async (tx) => {
      // Link to the studio's existing client with this email, or add them.
      const [existing] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.photographerId, studio.id), sql`lower(${clients.email}) = lower(${data.email})`))
        .limit(1);
      const clientId =
        existing?.id ??
        (
          await tx
            .insert(clients)
            .values({ photographerId: studio.id, name: data.name, email: data.email, phone: data.phone })
            .returning({ id: clients.id })
        )[0].id;

      const [booking] = await tx.insert(bookings).values({
        photographerId: studio.id,
        sessionTypeId: session.id,
        clientId,
        sessionName: session.name,
        priceCents: session.priceCents,
        depositPercent: session.depositPercent,
        startsAt,
        endsAt: new Date(startsAt.getTime() + session.durationMinutes * 60_000),
        clientName: data.name,
        clientEmail: data.email,
        clientPhone: data.phone,
        notes: data.notes,
        manageToken,
        addonsCents: extras.addonsCents,
      }).returning({ id: bookings.id });

      if (extras.lines.length > 0) {
        await tx.insert(bookingAddons).values(
          extras.lines.map((line) => ({
            bookingId: booking.id,
            addonId: line.id,
            name: line.name,
            priceCents: line.priceCents,
            quantity: line.quantity,
            includedQuantity: line.includedQuantity,
          })),
        );
      }
    });
  } catch (error) {
    if (isOverlapError(error)) return { taken: true };
    throw error;
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/booking/${manageToken}?new=1`);
}
