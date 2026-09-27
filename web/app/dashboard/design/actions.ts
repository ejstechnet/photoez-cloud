"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { cleanDesign, type Design } from "@/lib/design";
import { requirePhotographer } from "@/lib/session";
import { deletePrefix, signedUploadUrl, signedViewUrl, storedSize } from "@/lib/storage";

// Saving the Page Designer. Everything is checked by cleanDesign, and the
// banner photo can only be one this photographer uploaded.

const bannerKey = (photographerId: string, version: string) => `photographers/${photographerId}/branding/banner-${version}.jpg`;
const MAX_BANNER_BYTES = 6 * 1024 * 1024;

async function currentDesign(photographerId: string) {
  const [row] = await db.select({ design: photographers.design }).from(photographers).where(eq(photographers.id, photographerId));
  return cleanDesign(row?.design);
}

function revalidateStudioPages() {
  revalidatePath("/dashboard/design");
  revalidatePath("/studio/[slug]", "layout");
  revalidatePath("/g/[token]", "layout");
  revalidatePath("/booking/[token]", "layout");
  revalidatePath("/review/[token]", "layout");
}

export async function saveDesign(input: Partial<Design>): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  const current = await currentDesign(photographer.id);
  // The banner photo is managed by its own upload; keep whatever is stored.
  const design = cleanDesign({ ...input, bannerImageKey: current.bannerImageKey });
  if (design.banner === "photo" && !design.bannerImageKey) {
    return { error: "Upload a banner photo first, or choose a color banner." };
  }
  await db.update(photographers).set({ design }).where(eq(photographers.id, photographer.id));
  revalidateStudioPages();
  return { ok: true };
}

export async function prepareBannerUpload(size: number): Promise<{ version: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  if (size > MAX_BANNER_BYTES) return { error: "That photo is too large. Try a smaller one." };
  const version = randomBytes(6).toString("hex");
  return { version, url: await signedUploadUrl(bannerKey(photographer.id, version), "image/jpeg") };
}

// The uploaded banner becomes the studio's banner photo (replacing any old one).
export async function saveBannerPhoto(version: string): Promise<{ ok: true; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!/^[a-f0-9]{12}$/.test(version)) return { error: "That upload couldn't be saved." };
  const key = bannerKey(photographer.id, version);
  const size = await storedSize(key);
  if (size === null) return { error: "The photo upload didn't finish. Try again." };
  if (size > MAX_BANNER_BYTES) {
    await deletePrefix(key);
    return { error: "That photo is too large. Try a smaller one." };
  }
  const current = await currentDesign(photographer.id);
  if (current.bannerImageKey) await deletePrefix(current.bannerImageKey);
  await db
    .update(photographers)
    .set({ design: { ...current, bannerImageKey: key } })
    .where(eq(photographers.id, photographer.id));
  revalidateStudioPages();
  return { ok: true, url: await signedViewUrl(key) };
}
