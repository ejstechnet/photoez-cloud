// Tests for culling help.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cullGallery, differenceHash, exposure, hammingDistance, isCullMetrics, sharpness, toGray, type CullMetrics } from "./culling.ts";

const W = 120;
const H = 120;

// A crisp checkerboard, and the same board smeared with a box blur.
function checkerboard() {
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = (Math.floor(x / 4) + Math.floor(y / 4)) % 2;
  return g;
}
function blur(src: Float32Array, r = 4) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < H && xx >= 0 && xx < W) {
            s += src[yy * W + xx];
            n++;
          }
        }
      out[y * W + x] = s / n;
    }
  return out;
}

test("a sharp image scores far higher than a blurred one", () => {
  const sharp = sharpness(checkerboard(), W, H);
  const soft = sharpness(blur(checkerboard()), W, H);
  assert.ok(sharp > soft * 20, `${sharp} vs ${soft}`);
});

test("gray conversion and exposure", () => {
  const gray = toGray(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]));
  assert.deepEqual([...gray].map((v) => Math.round(v * 100) / 100), [1, 0]);
  const e = exposure(new Float32Array([0, 0, 0, 1]));
  assert.equal(e.brightness, 0.25);
  assert.equal(e.p10, 0);
  assert.equal(e.p90, 1);
  assert.equal(e.darkClip, 0.75);
  assert.equal(e.brightClip, 0.25);
});

test("fingerprints match for the same shot and differ for different ones", () => {
  const a = Array.from({ length: 72 }, (_, i) => (i * 37) % 11);
  const b = a.map((v, i) => (i === 5 ? v + 0.01 : v)); // tiny change
  const c = a.map((v) => 10 - v); // very different
  assert.match(differenceHash(a), /^[0-9a-f]{16}$/);
  assert.ok(hammingDistance(differenceHash(a), differenceHash(b)) <= 2);
  assert.ok(hammingDistance(differenceHash(a), differenceHash(c)) > 20);
});

const metrics = (over: Partial<CullMetrics>): CullMetrics => ({
  v: 3,
  sharpness: 2000,
  brightness: 0.5,
  darkClip: 0.01,
  brightClip: 0.01,
  p1: 0.03,
  p10: 0.15,
  p90: 0.85,
  p99: 0.98,
  hash: "0123456789abcdef",
  faces: 1,
  eyesClosed: 0,
  ...over,
});

test("a gallery is flagged: blurry, dark, bright, closed eyes, duplicates", () => {
  const result = cullGallery([
    { id: "a", cull: metrics({ hash: "ffffffffffffffff", sharpness: 2500 }) },
    { id: "b", cull: metrics({ hash: "fffffffffffffff0", sharpness: 2200 }) }, // near-duplicate of a
    { id: "c", cull: metrics({ hash: "0f0f0f0f0f0f0f0f", sharpness: 300 }) }, // soft next to the rest
    // Underexposed: dim all the way up, no highlights.
    { id: "d", cull: metrics({ hash: "00ff00ff00ff00ff", brightness: 0.1, darkClip: 0.5, p1: 0, p10: 0, p90: 0.2, p99: 0.3 }) },
    // Overexposed: washed out all the way down, no shadows.
    { id: "e", cull: metrics({ hash: "123412341234abcd", brightness: 0.9, brightClip: 0.4, p1: 0.7, p10: 0.85, p90: 1, p99: 1, eyesClosed: 1 }) },
    // Elle's low-key grad portrait (IM2A0762): dark green backdrop, p90 0.19, but real highlights.
    { id: "g", cull: metrics({ hash: "5555aaaa5555aaaa", brightness: 0.105, darkClip: 0.14, p1: 0, p10: 0.035, p90: 0.188, p99: 0.7 }) },
    // High-key portrait: white background, dark clothing. Not "too bright".
    { id: "h", cull: metrics({ hash: "3c3c3c3cc3c3c3c3", brightness: 0.88, brightClip: 0.6, p1: 0.05, p10: 0.2, p90: 1, p99: 1 }) },
    { id: "f", cull: null },
  ]);
  assert.deepEqual(result.flags.get("c"), ["blurry"]);
  assert.deepEqual(result.flags.get("d"), ["dark"]);
  assert.deepEqual(result.flags.get("e"), ["bright", "eyes"]);
  assert.deepEqual(result.duplicateSets, [["a", "b"]]); // sharpest first
  assert.deepEqual(result.flags.get("f"), []);
  assert.deepEqual(result.flags.get("g"), []);
  assert.deepEqual(result.flags.get("h"), []);
  assert.equal(result.unchecked, 1);
});

test("stored metrics are checked before use", () => {
  assert.ok(isCullMetrics(metrics({})));
  assert.ok(!isCullMetrics({ ...metrics({}), hash: "nope" }));
  assert.ok(!isCullMetrics(null));
});
