"use server";

import { randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { deletePrefix, signedUploadUrl, storedSize, studioLogoKey, watermarkKey } from "@/lib/storage";
import { MAX_WATERMARK_BYTES, WATERMARK_POSITIONS } from "@/lib/watermark";
import { OFFERABLE_TYPES, SHOOT_LOCATIONS } from "@/lib/session-types";
import { isAllowedSlug } from "@/lib/studio";

// Step 1 of replacing the watermark: a one-time link to upload the new PNG.
export async function prepareWatermarkUpload(
  file: { type: string; size: number },
): Promise<{ version: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  if (file.type !== "image/png") return { error: "Use a PNG file, ideally with a transparent background." };
  if (file.size > MAX_WATERMARK_BYTES) return { error: "Keep the watermark under 5 MB." };

  const version = randomBytes(6).toString("hex");
  return { version, url: await signedUploadUrl(watermarkKey(photographer.id, version), "image/png") };
}

const settingsSchema = z.object({
  opacity: z.coerce.number().int().min(5, "Pick at least 5%.").max(100),
  position: z.enum(WATERMARK_POSITIONS),
  // Set when a new watermark file was just uploaded (step 2).
  newVersion: z
    .string()
    .regex(/^[a-f0-9]{12}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type WatermarkFormState = { message?: string; saved?: boolean };

export async function saveWatermarkSettings(
  _prev: WatermarkFormState,
  formData: FormData,
): Promise<WatermarkFormState> {
  const photographer = await requirePhotographer();
  const parsed = settingsSchema.safeParse({
    opacity: formData.get("opacity"),
    position: formData.get("position"),
    newVersion: formData.get("newVersion") ?? "",
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check your watermark settings." };

  const [current] = await db
    .select({ key: photographers.watermarkKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));

  let key = current?.key ?? null;
  if (parsed.data.newVersion) {
    const newKey = watermarkKey(photographer.id, parsed.data.newVersion);
    const size = await storedSize(newKey);
    if (size === null) return { message: "The watermark upload didn't finish. Try again." };
    if (size > MAX_WATERMARK_BYTES) {
      await deletePrefix(newKey);
      return { message: "Keep the watermark under 5 MB." };
    }
    if (key) await deletePrefix(key);
    key = newKey;
  }
  if (!key) return { message: "Upload a watermark first." };

  await db
    .update(photographers)
    .set({
      watermarkKey: key,
      watermarkOpacity: parsed.data.opacity,
      watermarkPosition: parsed.data.position,
      // Every existing proof now needs the new look.
      watermarkUpdatedAt: new Date(),
    })
    .where(eq(photographers.id, photographer.id));

  revalidatePath("/dashboard", "layout");
  return { saved: true };
}

// ---- Studio logo ----
// Same two steps as the watermark: a one-time upload link, then a save that
// checks the file really arrived.

const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function prepareLogoUpload(file: {
  type: string;
  size: number;
}): Promise<{ version: string; extension: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  const extension = LOGO_TYPES[file.type as keyof typeof LOGO_TYPES];
  if (!extension) return { error: "Use a PNG, JPG, or WebP image." };
  if (file.size > MAX_LOGO_BYTES) return { error: "Keep the logo under 5 MB." };

  const version = randomBytes(6).toString("hex");
  const url = await signedUploadUrl(studioLogoKey(photographer.id, version, extension), file.type);
  return { version, extension, url };
}

export async function saveStudioLogo(version: string, extension: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!/^[a-f0-9]{12}$/.test(version) || !Object.values(LOGO_TYPES).includes(extension as "png")) {
    return { error: "That upload couldn't be saved." };
  }
  const key = studioLogoKey(photographer.id, version, extension);
  const size = await storedSize(key);
  if (size === null) return { error: "The logo upload didn't finish. Try again." };
  if (size > MAX_LOGO_BYTES) {
    await deletePrefix(key);
    return { error: "Keep the logo under 5 MB." };
  }

  const [current] = await db
    .select({ key: photographers.studioLogoKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (current?.key) await deletePrefix(current.key);

  await db.update(photographers).set({ studioLogoKey: key }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
  return { ok: true };
}

// The card color behind the logo, so logos with white (or any color) stay visible.
export async function saveLogoBackground(color: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  const value = color.trim().toLowerCase();
  if (value !== "transparent" && !/^#[0-9a-f]{6}$/.test(value)) return { error: "Pick a color from the list." };
  await db.update(photographers).set({ studioLogoBg: value }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
  return { ok: true };
}

export async function removeStudioLogo(): Promise<void> {
  const photographer = await requirePhotographer();
  const [current] = await db
    .select({ key: photographers.studioLogoKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (current?.key) await deletePrefix(current.key);
  await db.update(photographers).set({ studioLogoKey: null }).where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/settings");
  revalidatePath("/studio/[slug]", "page");
}

// ---- Studio profile ----

const typeList = z.array(z.enum(OFFERABLE_TYPES));

const studioSchema = z.object({
  businessName: z.string().trim().min(1, "Enter your studio's name.").max(120),
  studioSlug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isAllowedSlug, "Use 3–40 lowercase letters, numbers, and single hyphens (like elle-jones-studios)."),
  studioTagline: z.string().trim().max(140).transform((v) => v || null),
  studioBio: z.string().trim().max(2000).transform((v) => v || null),
  serviceArea: z.string().trim().max(120).transform((v) => v || null),
  offeredTypes: typeList.min(1, "Pick at least one session type you offer."),
  shootLocations: z.array(z.enum(SHOOT_LOCATIONS)).min(1, "Pick at least one place you shoot."),
  quoteOnlyTypes: typeList,
});

export type StudioFormState = {
  errors?: Partial<Record<keyof z.input<typeof studioSchema>, string>>;
  saved?: boolean;
};

export async function saveStudioProfile(_prev: StudioFormState, formData: FormData): Promise<StudioFormState> {
  const photographer = await requirePhotographer();
  const parsed = studioSchema.safeParse({
    businessName: String(formData.get("businessName") ?? ""),
    studioSlug: String(formData.get("studioSlug") ?? ""),
    studioTagline: String(formData.get("studioTagline") ?? ""),
    studioBio: String(formData.get("studioBio") ?? ""),
    serviceArea: String(formData.get("serviceArea") ?? ""),
    offeredTypes: formData.getAll("offeredTypes").map(String),
    shootLocations: formData.getAll("shootLocations").map(String),
    quoteOnlyTypes: formData.getAll("quoteOnlyTypes").map(String),
  });
  if (!parsed.success) {
    const errors: StudioFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof z.input<typeof studioSchema>;
      errors[field] ??= issue.message;
    }
    return { errors };
  }

  // The page address must be unique across all studios.
  const [taken] = await db
    .select({ id: photographers.id })
    .from(photographers)
    .where(and(eq(photographers.studioSlug, parsed.data.studioSlug), ne(photographers.id, photographer.id)));
  if (taken) return { errors: { studioSlug: "That address is taken. Try adding your city or last name." } };

  // A quote-only service must also be one you offer.
  const quoteOnlyTypes = parsed.data.quoteOnlyTypes.filter((type) => parsed.data.offeredTypes.includes(type));

  await db
    .update(photographers)
    .set({ ...parsed.data, quoteOnlyTypes, updatedAt: new Date() })
    .where(eq(photographers.id, photographer.id));

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/studio/${parsed.data.studioSlug}`);
  return { saved: true };
}

export async function removeWatermark(): Promise<void> {
  const photographer = await requirePhotographer();
  const [current] = await db
    .select({ key: photographers.watermarkKey })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (current?.key) await deletePrefix(current.key);

  await db
    .update(photographers)
    .set({ watermarkKey: null, watermarkUpdatedAt: new Date() })
    .where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard", "layout");
}
