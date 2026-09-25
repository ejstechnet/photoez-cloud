"use server";

import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { addons, sessionTypeAddons, sessionTypes } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { addonImageKey, deletePrefix, signedUploadUrl, storedSize } from "@/lib/storage";

// Server actions for booking add-ons. Each re-checks who is logged in and
// only touches that photographer's own add-ons and sessions.

const isUuid = (value: string) => z.uuid().safeParse(value).success;
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function refresh() {
  revalidatePath("/dashboard/bookings", "layout");
  revalidatePath("/studio/[slug]", "layout");
}

const addonSchema = z.object({
  name: z.string().trim().min(1, "Give the add-on a name.").max(120, "Keep the name under 120 characters."),
  description: z
    .string()
    .trim()
    .max(500, "Keep the description under 500 characters.")
    .transform((v) => v || null),
  // Typed in dollars ("10" or "10.00"), stored in cents.
  price: z
    .string()
    .trim()
    .transform((value) => value.replace(/[$,]/g, ""))
    .refine((value) => /^\d{1,6}(\.\d{1,2})?$/.test(value), "Enter a price like 10 or 10.00.")
    .transform((value) => Math.round(Number(value) * 100)),
  maxQuantity: z.coerce
    .number({ error: "Enter a number." })
    .int("Use a whole number.")
    .min(1, "Allow at least 1.")
    .max(500, "Keep it to 500 or fewer."),
});

type AddonField = keyof z.input<typeof addonSchema>;
export type AddonFormState = { errors?: Partial<Record<AddonField, string>>; message?: string };

function parseAddon(formData: FormData) {
  return addonSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
    price: text(formData, "price"),
    maxQuantity: text(formData, "maxQuantity"),
  });
}

function addonErrors(error: z.ZodError): AddonFormState {
  const errors: AddonFormState["errors"] = {};
  for (const issue of error.issues) errors[issue.path[0] as AddonField] ??= issue.message;
  return { errors };
}

export async function addAddon(_prev: AddonFormState, formData: FormData): Promise<AddonFormState> {
  const photographer = await requirePhotographer();
  const parsed = parseAddon(formData);
  if (!parsed.success) return addonErrors(parsed.error);
  const { price, ...values } = parsed.data;
  const existing = await db.select({ id: addons.id }).from(addons).where(eq(addons.photographerId, photographer.id));
  const [created] = await db
    .insert(addons)
    .values({ ...values, priceCents: price, photographerId: photographer.id, sortOrder: existing.length })
    .returning({ id: addons.id });
  refresh();
  // Straight to the add-on's page, where its photo can be added.
  redirect(`/dashboard/bookings/addons/${created.id}?added=1`);
}

export async function updateAddon(addonId: string, _prev: AddonFormState, formData: FormData): Promise<AddonFormState> {
  const photographer = await requirePhotographer();
  if (!isUuid(addonId)) return { message: "That add-on could not be found." };
  const parsed = parseAddon(formData);
  if (!parsed.success) return addonErrors(parsed.error);
  const { price, ...values } = parsed.data;
  const updated = await db
    .update(addons)
    .set({ ...values, priceCents: price })
    .where(and(eq(addons.id, addonId), eq(addons.photographerId, photographer.id)))
    .returning({ id: addons.id });
  if (updated.length === 0) return { message: "That add-on could not be found." };
  refresh();
  redirect("/dashboard/bookings/setup#addons");
}

// Past bookings keep their own copy of each extra, so deleting is safe.
export async function deleteAddon(addonId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (isUuid(addonId)) {
    const [deleted] = await db
      .delete(addons)
      .where(and(eq(addons.id, addonId), eq(addons.photographerId, photographer.id)))
      .returning({ imageKey: addons.imageKey });
    if (deleted?.imageKey) await deletePrefix(deleted.imageKey);
  }
  refresh();
  redirect("/dashboard/bookings/setup#addons");
}

// ---- Add-on photos ----

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function ownedAddon(photographerId: string, addonId: string) {
  if (!isUuid(addonId)) return null;
  const [row] = await db
    .select({ id: addons.id, imageKey: addons.imageKey })
    .from(addons)
    .where(and(eq(addons.id, addonId), eq(addons.photographerId, photographerId)));
  return row ?? null;
}

export async function prepareAddonImageUpload(
  addonId: string,
  size: number,
): Promise<{ version: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await ownedAddon(photographer.id, addonId))) return { error: "That add-on could not be found." };
  if (size > MAX_IMAGE_BYTES) return { error: "That photo is too large. Try a smaller one." };
  const version = randomBytes(6).toString("hex");
  return { version, url: await signedUploadUrl(addonImageKey(photographer.id, addonId, version), "image/jpeg") };
}

export async function saveAddonImage(addonId: string, version: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  const addon = await ownedAddon(photographer.id, addonId);
  if (!addon || !/^[a-f0-9]{12}$/.test(version)) return { error: "That upload couldn't be saved." };
  const key = addonImageKey(photographer.id, addonId, version);
  const size = await storedSize(key);
  if (size === null) return { error: "The photo upload didn't finish. Try again." };
  if (size > MAX_IMAGE_BYTES) {
    await deletePrefix(key);
    return { error: "That photo is too large. Try a smaller one." };
  }
  if (addon.imageKey) await deletePrefix(addon.imageKey);
  await db.update(addons).set({ imageKey: key }).where(eq(addons.id, addon.id));
  refresh();
  return { ok: true };
}

export async function removeAddonImage(addonId: string): Promise<void> {
  const photographer = await requirePhotographer();
  const addon = await ownedAddon(photographer.id, addonId);
  if (!addon?.imageKey) return;
  await deletePrefix(addon.imageKey);
  await db.update(addons).set({ imageKey: null }).where(eq(addons.id, addon.id));
  refresh();
}

// ---- Which add-ons a session offers ----

export type SessionAddonsState = { message?: string; saved?: boolean };

// The form sends `offer` for each checked add-on and `included.<id>` for how
// many come with the session.
export async function saveSessionAddons(
  sessionTypeId: string,
  _prev: SessionAddonsState,
  formData: FormData,
): Promise<SessionAddonsState> {
  const photographer = await requirePhotographer();
  if (!isUuid(sessionTypeId)) return { message: "That session could not be found." };
  const [session] = await db
    .select({ id: sessionTypes.id })
    .from(sessionTypes)
    .where(and(eq(sessionTypes.id, sessionTypeId), eq(sessionTypes.photographerId, photographer.id)));
  if (!session) return { message: "That session could not be found." };

  const chosen = formData.getAll("offer").map(String).filter(isUuid);
  const owned = chosen.length
    ? await db
        .select({ id: addons.id })
        .from(addons)
        .where(and(eq(addons.photographerId, photographer.id), inArray(addons.id, chosen)))
    : [];
  const rows: (typeof sessionTypeAddons.$inferInsert)[] = [];
  for (const { id } of owned) {
    const included = Number(text(formData, `included.${id}`) || 0);
    if (!Number.isInteger(included) || included < 0 || included > 500) {
      return { message: "Included amounts must be whole numbers from 0 to 500." };
    }
    rows.push({ sessionTypeId: session.id, addonId: id, includedQuantity: included });
  }

  await db.transaction(async (tx) => {
    await tx.delete(sessionTypeAddons).where(eq(sessionTypeAddons.sessionTypeId, session.id));
    if (rows.length > 0) await tx.insert(sessionTypeAddons).values(rows);
  });
  refresh();
  return { saved: true };
}
