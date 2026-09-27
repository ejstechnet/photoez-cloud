"use client";

import { differenceHash, exposure, sharpness, toGray, type CullMetrics } from "./culling";

// Measures photos for culling help, entirely in the photographer's browser:
// sharpness and exposure from a 640px copy, a fingerprint from a 9×8 copy,
// and closed eyes from Google's free MediaPipe face model (downloaded once,
// run locally; photos never leave the browser for this).

const WORK_EDGE = 640;
const MEDIAPIPE_VERSION = "1.0.1";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
// Both eyes this "blinked" or more counts as closed. High, because looking
// down (at a diploma, a baby) also reads as a partial blink.
const BLINK = 0.75;

type FaceLandmarker = import("@mediapipe/tasks-vision").FaceLandmarker;
let landmarker: Promise<FaceLandmarker | null> | null = null;

// Loads the face model once; if it can't load (offline, blocked), culling
// still works without the closed-eyes check.
function faceModel() {
  landmarker ??= (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      return await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL },
        runningMode: "IMAGE",
        numFaces: 10,
        outputFaceBlendshapes: true,
      });
    } catch (error) {
      console.warn("Face model unavailable; skipping the closed-eyes check.", error);
      return null;
    }
  })();
  return landmarker;
}

function draw(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, pixels: ctx.getImageData(0, 0, width, height).data };
}

export async function measurePhoto(url: string): Promise<CullMetrics> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("A photo couldn't be loaded.");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const scale = Math.min(1, WORK_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(8, Math.round(bitmap.width * scale));
    const height = Math.max(8, Math.round(bitmap.height * scale));
    const { canvas, pixels } = draw(bitmap, width, height);
    const gray = toGray(pixels);
    const light = exposure(gray);

    const tiny = draw(bitmap, 9, 8);
    const hash = differenceHash(toGray(tiny.pixels));

    let faces: number | null = null;
    let eyesClosed: number | null = null;
    const model = await faceModel();
    if (model) {
      const result = model.detect(canvas as unknown as ImageBitmap);
      faces = result.faceBlendshapes.length;
      eyesClosed = result.faceBlendshapes.filter((face) => {
        const score = (name: string) => face.categories.find((c) => c.categoryName === name)?.score ?? 0;
        return score("eyeBlinkLeft") >= BLINK && score("eyeBlinkRight") >= BLINK;
      }).length;
    }

    return {
      v: 3,
      sharpness: Math.round(sharpness(gray, width, height) * 100) / 100,
      brightness: Math.round(light.brightness * 1000) / 1000,
      darkClip: Math.round(light.darkClip * 1000) / 1000,
      brightClip: Math.round(light.brightClip * 1000) / 1000,
      p1: Math.round(light.p1 * 1000) / 1000,
      p10: Math.round(light.p10 * 1000) / 1000,
      p90: Math.round(light.p90 * 1000) / 1000,
      p99: Math.round(light.p99 * 1000) / 1000,
      hash,
      faces,
      eyesClosed,
    };
  } finally {
    bitmap.close();
  }
}
