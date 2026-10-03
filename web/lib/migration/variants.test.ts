// Tests for making imported photos' sizes and proofs.   npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { makeVariants } from "./variants.ts";

const photo = (width: number, height: number, orientation?: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 60, b: 120 } } })
    .jpeg()
    .withMetadata(orientation ? { orientation } : {})
    .toBuffer();
const mark = sharp({ create: { width: 400, height: 100, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .png()
  .toBuffer();

test("previews and thumbnails are capped at 2048 and 900 pixels", async () => {
  const v = await makeVariants(await photo(4000, 3000), null);
  assert.deepEqual([v.width, v.height], [4000, 3000]);
  assert.equal((await sharp(v.preview).metadata()).width, 2048);
  assert.equal((await sharp(v.thumb).metadata()).width, 900);
  assert.equal(v.proof, null);
});

test("small photos aren't enlarged", async () => {
  const v = await makeVariants(await photo(800, 600), null);
  assert.equal((await sharp(v.preview).metadata()).width, 800);
});

test("a sideways camera photo is turned upright", async () => {
  // Orientation 6: stored landscape, shown portrait.
  const v = await makeVariants(await photo(1200, 800, 6), null);
  assert.deepEqual([v.width, v.height], [800, 1200]);
  const p = await sharp(v.preview).metadata();
  assert.deepEqual([p.width, p.height], [800, 1200]);
});

test("proofs get the watermark", async () => {
  const v = await makeVariants(await photo(2000, 1000), { image: await mark, opacity: 50, position: "center" });
  assert.ok(v.proof);
  // The middle of the proof is lighter than the plain preview (white mark at 50%).
  const at = async (buf: Buffer) => (await sharp(buf).extract({ left: 1000, top: 500, width: 1, height: 1 }).raw().toBuffer())[0];
  assert.ok((await at(v.proof!)) > (await at(v.preview)) + 60);
});
