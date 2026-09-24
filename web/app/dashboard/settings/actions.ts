"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { deletePrefix, signedUploadUrl, storedSize, watermarkKey } from "@/lib/storage";
import { MAX_WATERMARK_BYTES, WATERMARK_POSITIONS } from "@/lib/watermark";

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
