// Browser-only helpers that resize photos and stamp the watermark onto proofs.
// All of this runs in the photographer's browser, so the server never has to
// decode or re-encode images.

import { PROOF_MAX_EDGE, watermarkBox, type WatermarkPosition } from "./watermark";

export type WatermarkSettings = { url: string; opacity: number; position: WatermarkPosition };
export type LoadedWatermark = { image: ImageBitmap; opacity: number; position: WatermarkPosition };

// Download the watermark once per batch. fetch → blob keeps the canvas
// untainted, so the finished proof can still be exported.
export async function loadWatermark(settings: WatermarkSettings | null): Promise<LoadedWatermark | null> {
  if (!settings) return null;
  const response = await fetch(settings.url);
  if (!response.ok) throw new Error("Couldn't load your watermark.");
  const image = await createImageBitmap(await response.blob());
  return { image, opacity: settings.opacity, position: settings.position };
}

// Draw `source` at most `maxEdge` px on its long side, optionally stamping the
// watermark, and export a JPEG.
export function renderJpeg(
  source: ImageBitmap,
  maxEdge: number,
  quality: number,
  watermark: LoadedWatermark | null = null,
) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  if (watermark) {
    const box = watermarkBox(
      canvas.width,
      canvas.height,
      watermark.image.width,
      watermark.image.height,
      watermark.position,
    );
    context.globalAlpha = Math.max(0, Math.min(100, watermark.opacity)) / 100;
    context.drawImage(watermark.image, box.x, box.y, box.width, box.height);
    context.globalAlpha = 1;
  }

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that photo."))), "image/jpeg", quality),
  );
}

export const makeProof = (source: ImageBitmap, watermark: LoadedWatermark) =>
  renderJpeg(source, PROOF_MAX_EDGE, 0.85, watermark);
