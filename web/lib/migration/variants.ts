import sharp from "sharp";
import { PROOF_MAX_EDGE, watermarkBox, type WatermarkPosition } from "../watermark.ts";

// The sizes an imported photo needs, made on the server the same way the
// browser makes them at upload (app/dashboard/galleries/[id]/uploader.tsx and
// lib/proof-maker.ts): a 2048px preview, a 900px thumbnail, and for proofs a
// 2048px copy with the studio's watermark. Tested in variants.test.ts.

export type Watermark = { image: Buffer; opacity: number; position: WatermarkPosition };

export async function makeVariants(original: Buffer, watermark: Watermark | null) {
  // .rotate() turns the photo upright from its camera orientation, like the browser does.
  const meta = await sharp(original).rotate().metadata();
  const upright = await sharp(original).rotate().toBuffer();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;

  const resize = (edge: number) =>
    sharp(upright).resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true });
  const preview = await resize(2048).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  const thumb = await resize(900).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const proof = watermark ? await stamp(await resize(PROOF_MAX_EDGE).toBuffer(), watermark) : null;
  return { width, height, preview, thumb, proof };
}

// The watermark at the studio's opacity and position (watermarkBox), as a JPEG.
export async function stamp(image: Buffer, watermark: Watermark) {
  const base = sharp(image);
  const { width = 0, height = 0 } = await base.metadata();
  const wmMeta = await sharp(watermark.image).metadata();
  const box = watermarkBox(width, height, wmMeta.width ?? 1, wmMeta.height ?? 1, watermark.position);
  const alpha = Math.max(0, Math.min(100, watermark.opacity)) / 100;
  // Scale the watermark, then lower its transparency to the studio's opacity.
  const mark = await sharp(watermark.image)
    .resize(box.width, box.height, { fit: "fill" })
    .ensureAlpha()
    .composite([{ input: Buffer.from([255, 255, 255, Math.round(255 * alpha)]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: "dest-in" }])
    .png()
    .toBuffer();
  return base.composite([{ input: mark, left: box.x, top: box.y }]).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}
