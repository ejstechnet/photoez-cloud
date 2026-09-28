import sharp from "sharp";
import type { StoreCrop } from "@/db/schema";
import { photoKey, readObject } from "@/lib/storage";
import { cropPixels } from "./rules";

// A store item's print-ready file: the full-resolution original, turned
// upright and cropped exactly the way the client framed it, as a
// high-quality JPEG tagged 300 DPI. Used for the studio's "Download print
// file" and for files sent to SwaggPress. Null when the photo is gone.
export async function makePrintFile(photoFileKey: string, crop: StoreCrop | null) {
  const original = await readObject(photoKey(photoFileKey, "original"));
  if (!original) return null;
  let image = sharp(original).rotate();
  if (crop) {
    const upright = await image.toBuffer({ resolveWithObject: true });
    image = sharp(upright.data).extract(cropPixels(crop, { width: upright.info.width, height: upright.info.height }));
  }
  return image.jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).withMetadata({ density: 300 }).toBuffer();
}
