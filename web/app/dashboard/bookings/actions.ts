"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { blackoutDates, bookingHours, bookings, photographers, sessionTypes } from "@/db/schema";
import { isOverlapError } from "@/lib/booking/availability";
import { isValidTimeZone } from "@/lib/booking/time";
import { cleanRichTextInput, richTextToPlain } from "@/lib/rich-text";
import { requirePhotographer } from "@/lib/session";
import { SHOOT_LOCATIONS } from "@/lib/session-types";

// Server actions for booking setup and managing bookings. Like every other
// dashboard action, each re-checks who is logged in and only touches that
// photographer's own rows.

const isUuid = (value: string) => z.uuid().safeParse(value).success;
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function done(path = "/dashboard/bookings"): never {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/studio/[slug]", "layout");
  redirect(path);
}

// ---- Session types ----

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const sessionTypeSchema = z.object({
  name: z.string().trim().min(1, "Give the session a name.").max(120, "Keep the name under 120 characters."),
  shortDescription: optionalText(200, "Keep the summary under 200 characters."),
  description: z
    .string()
    .max(50000, "That description is too long.")
    .transform(cleanRichTextInput)
    .refine((v) => v === null || richTextToPlain(v).length <= 5000, "Keep the description under 5,000 characters."),
  durationMinutes: z.coerce
    .number({ error: "Enter the length in minutes." })
    .int("Use whole minutes.")
    .min(5, "Sessions must be at least 5 minutes.")
    .max(720, "Sessions can be up to 12 hours."),
  // Typed in dollars ("150" or "150.00"), stored in cents.
  price: z
    .string()
    .trim()
    .transform((value) => value.replace(/[$,]/g, ""))
    .refine((value) => /^\d{1,6}(\.\d{1,2})?$/.test(value), "Enter a price like 150 or 150.00.")
    .transform((value) => Math.round(Number(value) * 100)),
  depositPercent: z.coerce
    .number({ error: "Enter a percentage." })
    .int("Use a whole percentage.")
    .min(0, "Use 0 to 100.")
    .max(100, "Use 0 to 100."),
  location: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || (SHOOT_LOCATIONS as readonly string[]).includes(value), "Pick a location."),
  photosIncluded: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{1,4}$/.test(value), "Enter a number of photos, or leave it blank.")
    .transform((value) => (value === "" ? null : Number(value))),
  hidden: z.boolean(),
});

type SessionTypeField = keyof z.input<typeof sessionTypeSchema>;

export type SessionTypeFormState = {
  errors?: Partial<Record<SessionTypeField, string>>;
  message?: string;
};

function parseSessionType(formData: FormData) {
  return sessionTypeSchema.safeParse({
    name: text(formData, "name"),
    shortDescription: text(formData, "shortDescription"),
    description: text(formData, "description"),
    durationMinutes: text(formData, "durationMinutes"),
    price: text(formData, "price"),
    depositPercent: text(formData, "depositPercent"),
    location: text(formData, "location"),
    photosIncluded: text(formData, "photosIncluded"),
    hidden: formData.get("hidden") === "on",
  });
}

function sessionTypeErrors(error: z.ZodError): SessionTypeFormState {
  const errors: SessionTypeFormState["errors"] = {};
  for (const issue of error.issues) errors[issue.path[0] as SessionTypeField] ??= issue.message;
  return { errors };
}

export async function addSessionType(_prev: SessionTypeFormState, formData: FormData): Promise<SessionTypeFormState> {
  const photographer = await requirePhotographer();
  const parsed = parseSessionType(formData);
  if (!parsed.success) return sessionTypeErrors(parsed.error);

  const { price, ...values } = parsed.data;
  const existing = await db
    .select({ id: sessionTypes.id })
    .from(sessionTypes)
    .where(eq(sessionTypes.photographerId, photographer.id));
  await db.insert(sessionTypes).values({
    ...values,
    priceCents: price,
    photographerId: photographer.id,
    sortOrder: existing.length,
  });
  done("/dashboard/bookings/setup");
}

export async function updateSessionType(
  sessionTypeId: string,
  _prev: SessionTypeFormState,
  formData: FormData,
): Promise<SessionTypeFormState> {
  const photographer = await requirePhotographer();
  if (!isUuid(sessionTypeId)) return { message: "That session could not be found." };
  const parsed = parseSessionType(formData);
  if (!parsed.success) return sessionTypeErrors(parsed.error);

  const { price, ...values } = parsed.data;
  const updated = await db
    .update(sessionTypes)
    .set({ ...values, priceCents: price })
    .where(and(eq(sessionTypes.id, sessionTypeId), eq(sessionTypes.photographerId, photographer.id)))
    .returning({ id: sessionTypes.id });
  if (updated.length === 0) return { message: "That session could not be found." };
  done("/dashboard/bookings/setup");
}

// Existing bookings keep their own copy of the name and price, so deleting a
// session type never changes a booking.
export async function deleteSessionType(sessionTypeId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (isUuid(sessionTypeId)) {
    await db
      .delete(sessionTypes)
      .where(and(eq(sessionTypes.id, sessionTypeId), eq(sessionTypes.photographerId, photographer.id)));
  }
  done("/dashboard/bookings/setup");
}

// ---- Availability: time zone, notice, weekly hours ----

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type AvailabilityFormState = { message?: string; saved?: boolean };

export async function saveAvailability(_prev: AvailabilityFormState, formData: FormData): Promise<AvailabilityFormState> {
  const photographer = await requirePhotographer();

  const timeZone = text(formData, "timeZone");
  if (!isValidTimeZone(timeZone)) return { message: "Pick a time zone from the list." };
  const minNoticeDays = Number(text(formData, "minNoticeDays"));
  if (!Number.isInteger(minNoticeDays) || minNoticeDays < 0 || minNoticeDays > 365) {
    return { message: "Minimum notice must be 0 to 365 days." };
  }
  const bufferMinutes = Number(text(formData, "bufferMinutes"));
  if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 240) {
    return { message: "The buffer must be 0 to 240 minutes." };
  }

  const days: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
  for (let day = 0; day < 7; day++) {
    if (formData.get(`day${day}.open`) !== "on") continue;
    const startTime = text(formData, `day${day}.start`);
    const endTime = text(formData, `day${day}.end`);
    if (!TIME.test(startTime) || !TIME.test(endTime)) return { message: "Enter opening and closing times for each open day." };
    if (endTime <= startTime) return { message: "Each open day must close after it opens." };
    days.push({ dayOfWeek: day, startTime, endTime });
  }

  await db.transaction(async (tx) => {
    await tx.update(photographers).set({ timeZone, minNoticeDays }).where(eq(photographers.id, photographer.id));
    await tx.delete(bookingHours).where(eq(bookingHours.photographerId, photographer.id));
    if (days.length > 0) {
      await tx
        .insert(bookingHours)
        .values(days.map((day) => ({ ...day, bufferMinutes, photographerId: photographer.id })));
    }
  });

  revalidatePath("/dashboard/bookings", "layout");
  revalidatePath("/studio/[slug]", "layout");
  return { saved: true };
}

// ---- Time off ----

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type TimeOffFormState = { message?: string };

export async function addTimeOff(_prev: TimeOffFormState, formData: FormData): Promise<TimeOffFormState> {
  const photographer = await requirePhotographer();
  const startDate = text(formData, "startDate");
  const endDate = text(formData, "endDate") || startDate;
  const note = text(formData, "note").trim().slice(0, 200) || null;
  if (!DATE.test(startDate) || !DATE.test(endDate)) return { message: "Pick the first day off." };
  if (endDate < startDate) return { message: "The last day can't be before the first day." };

  await db.insert(blackoutDates).values({ photographerId: photographer.id, startDate, endDate, note });
  revalidatePath("/dashboard/bookings", "layout");
  revalidatePath("/studio/[slug]", "layout");
  return {};
}

export async function deleteTimeOff(timeOffId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (!isUuid(timeOffId)) return;
  await db
    .delete(blackoutDates)
    .where(and(eq(blackoutDates.id, timeOffId), eq(blackoutDates.photographerId, photographer.id)));
  revalidatePath("/dashboard/bookings", "layout");
  revalidatePath("/studio/[slug]", "layout");
}

// ---- Bookings ----

export async function setBookingStatus(
  bookingId: string,
  status: "confirmed" | "completed" | "cancelled",
): Promise<{ message?: string }> {
  const photographer = await requirePhotographer();
  if (!isUuid(bookingId)) return { message: "That booking could not be found." };
  try {
    await db
      .update(bookings)
      .set({ status, cancelledAt: status === "cancelled" ? new Date() : null })
      .where(and(eq(bookings.id, bookingId), eq(bookings.photographerId, photographer.id)));
  } catch (error) {
    // Restoring a cancelled booking whose time has since been taken.
    if (isOverlapError(error)) return { message: "Another booking now takes that time, so it can't be restored." };
    throw error;
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/studio/[slug]", "layout");
  return {};
}
