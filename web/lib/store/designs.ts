import { randomUUID } from "node:crypto";
import { and, count, eq, gt, isNull, lt } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { photos, storeDesigns, storeOrderItems, storeProducts } from "@/db/schema";
import { deletePrefix, designPhotoKey, photoKey, putObject, readObject, signedUploadUrl, signedViewUrl, storedSize, storeDesignKey } from "@/lib/storage";

// Designs clients make in the gallery designer (the shared swagg-designer,
// loaded from /vendor/swagg-designer.js). The browser draws the preview and
// print-ready PNGs itself and uploads them straight to storage (like photo
// uploads, so large print files never pass through this server); then the
// design is saved here and its id goes in the cart. Checkout and SwaggPress
// orders use these files instead of the plain photo.

const MB = 1024 * 1024;
const LIMITS = { preview: 8 * MB, front: 60 * MB, back: 60 * MB };
// Keeps one gallery from filling storage.
const MAX_DESIGNS_PER_DAY = 150;
const UNORDERED_DAYS = 30;

type Part = "preview" | "front" | "back";

// Step 1: where to upload the files. Only products with a design setup.
export async function startDesign(options: { galleryId: string; photographerId: string; productId: string; hasBack: boolean }) {
  const [product] = await db
    .select({ id: storeProducts.id, labDesign: storeProducts.labDesign })
    .from(storeProducts)
    .where(and(eq(storeProducts.id, options.productId), eq(storeProducts.photographerId, options.photographerId), eq(storeProducts.active, true)));
  if (!product?.labDesign) return { error: "This product can't be designed." };
  const [{ n }] = await db
    .select({ n: count() })
    .from(storeDesigns)
    .where(and(eq(storeDesigns.galleryId, options.galleryId), gt(storeDesigns.createdAt, new Date(Date.now() - 86_400_000))));
  if (n >= MAX_DESIGNS_PER_DAY) return { error: "That's a lot of designs for one day! Please try again tomorrow." };
  const designId = randomUUID();
  const parts: Part[] = options.hasBack && product.labDesign.back ? ["preview", "front", "back"] : ["preview", "front"];
  const uploads: Partial<Record<Part, string>> = {};
  for (const part of parts) {
    uploads[part] = await signedUploadUrl(storeDesignKey(options.photographerId, options.galleryId, designId, part), "image/png");
  }
  return { designId, uploads };
}

// Step 2: once the files are uploaded, the design is saved.
export async function finishDesign(options: {
  galleryId: string;
  photographerId: string;
  designId: string;
  productId: string;
  design: unknown;
  photoIds: string[];
}): Promise<{ id: string; previewUrl: string } | { error: string }> {
  const [product] = await db
    .select({ id: storeProducts.id, labDesign: storeProducts.labDesign })
    .from(storeProducts)
    .where(and(eq(storeProducts.id, options.productId), eq(storeProducts.photographerId, options.photographerId)));
  if (!product?.labDesign) return { error: "This product can't be designed." };
  const design = options.design as { version?: unknown; sides?: { front?: unknown; back?: unknown } } | null;
  if (!design || design.version !== 1 || !Array.isArray(design.sides?.front)) return { error: "The design couldn't be read. Please try again." };
  const json = JSON.stringify(design);
  if (json.length > 900_000) return { error: "That design is too large to save. Try removing a few things." };

  const key = (part: Part) => storeDesignKey(options.photographerId, options.galleryId, options.designId, part);
  const sizes = {
    preview: await storedSize(key("preview")),
    front: await storedSize(key("front")),
    back: await storedSize(key("back")),
  };
  if (!sizes.preview || !sizes.front) return { error: "The design's pictures didn't finish uploading. Please try again." };
  for (const part of ["preview", "front", "back"] as const) {
    if ((sizes[part] ?? 0) > LIMITS[part]) return { error: "The design's files are too large." };
  }
  const [taken] = await db.select({ id: storeDesigns.id }).from(storeDesigns).where(eq(storeDesigns.id, options.designId));
  if (taken) return { error: "That design was already saved." };

  const finals = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(eq(photos.galleryId, options.galleryId), eq(photos.kind, "final")));
  const photoIds = options.photoIds.filter((id) => finals.some((f) => f.id === id)).slice(0, 50);
  await db.insert(storeDesigns).values({
    id: options.designId,
    photographerId: options.photographerId,
    galleryId: options.galleryId,
    productId: product.id,
    design: JSON.parse(json),
    previewKey: key("preview"),
    frontKey: key("front"),
    backKey: sizes.back ? key("back") : null,
    photoIds,
  });
  return { id: options.designId, previewUrl: await signedViewUrl(key("preview")) };
}

// A gallery's saved design, for checkout (null when it isn't this gallery's).
export async function galleryDesign(galleryId: string, designId: string) {
  const [row] = await db
    .select()
    .from(storeDesigns)
    .where(and(eq(storeDesigns.id, designId), eq(storeDesigns.galleryId, galleryId)));
  return row ?? null;
}

// A final photo for the designer, clean and up to 3600px (sharp enough for
// a 12-inch print at 300 DPI), made once and kept beside the photo.
export async function designPhoto(fileKey: string): Promise<Uint8Array | null> {
  const cached = await readObject(designPhotoKey(fileKey));
  if (cached) return cached;
  const original = await readObject(photoKey(fileKey, "original"));
  if (!original) return null;
  const jpeg = await sharp(original)
    .rotate()
    .resize({ width: 3600, height: 3600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
  const bytes = new Uint8Array(jpeg);
  await putObject(designPhotoKey(fileKey), bytes, "image/jpeg");
  return bytes;
}

// Designs never ordered are removed after 30 days (from the cron job).
export async function removeOldDesigns(now = new Date()) {
  const old = await db
    .select({ id: storeDesigns.id, previewKey: storeDesigns.previewKey })
    .from(storeDesigns)
    .leftJoin(storeOrderItems, eq(storeOrderItems.designId, storeDesigns.id))
    .where(and(lt(storeDesigns.createdAt, new Date(now.getTime() - UNORDERED_DAYS * 86_400_000)), isNull(storeOrderItems.id)))
    .limit(200);
  for (const d of old) {
    await deletePrefix(d.previewKey.replace(/preview\.png$/, ""));
    await db.delete(storeDesigns).where(eq(storeDesigns.id, d.id));
  }
  return old.length;
}
