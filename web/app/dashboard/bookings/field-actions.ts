"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { bookingFields, photographers, sessionTypes } from "@/db/schema";
import { BOOKING_FIELD_TYPES } from "@/lib/booking/fields";
import { moveInList } from "@/lib/reorder";
import { requirePhotographer } from "@/lib/session";

// Server actions for the studio's custom booking questions and the inspo
// photo setting. Each re-checks who is logged in and only touches that
// photographer's own questions and sessions.

const isUuid = (value: string) => z.uuid().safeParse(value).success;
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function refresh() {
  revalidatePath("/dashboard/bookings", "layout");
  revalidatePath("/studio/[slug]", "layout");
}

const fieldSchema = z
  .object({
    label: z.string().trim().min(1, "Write the question.").max(200, "Keep the question under 200 characters."),
    type: z.enum(BOOKING_FIELD_TYPES, { error: "Pick a type." }),
    // Dropdown choices, one per line.
    options: z
      .string()
      .transform((v) => [...new Set(v.split(/\r?\n/).map((o) => o.trim()).filter(Boolean))])
      .refine((o) => o.length <= 30, "Keep it to 30 choices or fewer.")
      .refine((o) => o.every((x) => x.length <= 100), "Keep each choice under 100 characters."),
    required: z.boolean(),
  })
  .refine((f) => f.type !== "select" || f.options.length >= 2, {
    path: ["options"],
    message: "Give the dropdown at least two choices, one per line.",
  });

type FieldKey = keyof z.input<typeof fieldSchema> | "sessions";
export type FieldFormState = { errors?: Partial<Record<FieldKey, string>>; message?: string };

async function parseField(formData: FormData, photographerId: string) {
  const parsed = fieldSchema.safeParse({
    label: text(formData, "label"),
    type: text(formData, "type"),
    options: text(formData, "options"),
    required: formData.get("required") === "on",
  });
  if (!parsed.success) {
    const errors: FieldFormState["errors"] = {};
    for (const issue of parsed.error.issues) errors[issue.path[0] as FieldKey] ??= issue.message;
    return { ok: false as const, state: { errors } };
  }
  // "Some sessions" keeps only this studio's own session ids.
  let sessionTypeIds: string[] = [];
  if (text(formData, "appliesTo") === "some") {
    const chosen = formData.getAll("sessionTypeIds").map(String).filter(isUuid);
    const owned = chosen.length
      ? await db
          .select({ id: sessionTypes.id })
          .from(sessionTypes)
          .where(and(eq(sessionTypes.photographerId, photographerId), inArray(sessionTypes.id, chosen)))
      : [];
    if (owned.length === 0) return { ok: false as const, state: { errors: { sessions: "Pick at least one session." } } };
    sessionTypeIds = owned.map((s) => s.id);
  }
  const { options, type, ...rest } = parsed.data;
  return { ok: true as const, values: { ...rest, type, options: type === "select" ? options : [], sessionTypeIds } };
}

export async function addField(_prev: FieldFormState, formData: FormData): Promise<FieldFormState> {
  const photographer = await requirePhotographer();
  const result = await parseField(formData, photographer.id);
  if (!result.ok) return result.state;
  const existing = await db
    .select({ id: bookingFields.id })
    .from(bookingFields)
    .where(eq(bookingFields.photographerId, photographer.id));
  await db
    .insert(bookingFields)
    .values({ ...result.values, photographerId: photographer.id, sortOrder: existing.length });
  refresh();
  redirect("/dashboard/bookings/setup#form");
}

export async function updateField(fieldId: string, _prev: FieldFormState, formData: FormData): Promise<FieldFormState> {
  const photographer = await requirePhotographer();
  if (!isUuid(fieldId)) return { message: "That question could not be found." };
  const result = await parseField(formData, photographer.id);
  if (!result.ok) return result.state;
  const updated = await db
    .update(bookingFields)
    .set(result.values)
    .where(and(eq(bookingFields.id, fieldId), eq(bookingFields.photographerId, photographer.id)))
    .returning({ id: bookingFields.id });
  if (updated.length === 0) return { message: "That question could not be found." };
  refresh();
  redirect("/dashboard/bookings/setup#form");
}

// Past bookings keep their answers with the question's wording, so deleting is safe.
export async function deleteField(fieldId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (isUuid(fieldId)) {
    await db
      .delete(bookingFields)
      .where(and(eq(bookingFields.id, fieldId), eq(bookingFields.photographerId, photographer.id)));
  }
  refresh();
  redirect("/dashboard/bookings/setup#form");
}

export async function moveField(fieldId: string, by: -1 | 1): Promise<void> {
  const photographer = await requirePhotographer();
  const rows = await db
    .select({ id: bookingFields.id })
    .from(bookingFields)
    .where(eq(bookingFields.photographerId, photographer.id))
    .orderBy(asc(bookingFields.sortOrder), asc(bookingFields.createdAt));
  const order = moveInList(
    rows.map((r) => r.id),
    fieldId,
    by,
  );
  if (!order) return;
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) {
      await tx.update(bookingFields).set({ sortOrder: i }).where(eq(bookingFields.id, id));
    }
  });
  refresh();
}

// Off / optional / required inspiration photos on the booking form.
export async function saveInspoMode(mode: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (mode !== "off" && mode !== "optional" && mode !== "required") return;
  await db.update(photographers).set({ inspoMode: mode }).where(eq(photographers.id, photographer.id));
  refresh();
}
