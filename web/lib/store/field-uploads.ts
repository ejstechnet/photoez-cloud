import { randomUUID } from "node:crypto";
import { signedUploadUrl, signedViewUrl, storedSize, storeUploadKey } from "@/lib/storage";

// Files a client uploads for a Custom Text & Photos product's photo fields
// (a school logo, their own artwork). The browser uploads straight to
// storage, like photo uploads; the cart and order keep "upload:<file>"
// entries beside gallery photo ids (store_order_items.field_photo_ids).

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 25 * 1024 * 1024;
const ENTRY = /^upload:[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

export const isFieldUpload = (entry: string) => ENTRY.test(entry);

const fileOf = (entry: string) => entry.slice("upload:".length);

// Where to upload one file, and the entry that stands for it.
export async function startFieldUpload(options: { photographerId: string; galleryId: string; contentType: string; size: number }) {
  const ext = TYPES[options.contentType];
  if (!ext) return { error: "Please use a JPG, PNG, WebP, or GIF image." };
  if (!(options.size > 0) || options.size > MAX_BYTES) return { error: "That file is too large (up to 25 MB)." };
  const file = `${randomUUID()}.${ext}`;
  return {
    entry: `upload:${file}`,
    url: await signedUploadUrl(storeUploadKey(options.photographerId, options.galleryId, file), options.contentType),
  };
}

// True when every entry was really uploaded to this gallery, within the size limit.
export async function fieldUploadsExist(photographerId: string, galleryId: string, entries: string[]) {
  for (const entry of entries) {
    const size = await storedSize(storeUploadKey(photographerId, galleryId, fileOf(entry)));
    if (!size || size > MAX_BYTES) return false;
  }
  return true;
}

// Short-lived links to the uploads (for SwaggPress to download, or the studio to view).
export function fieldUploadUrls(photographerId: string, galleryId: string, entries: string[]) {
  return Promise.all(entries.map((entry) => signedViewUrl(storeUploadKey(photographerId, galleryId, fileOf(entry)))));
}
