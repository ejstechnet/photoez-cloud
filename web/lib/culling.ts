// Culling help: flags photos that are probably keepers-to-skip (blurry, too
// dark or bright, closed eyes, near-duplicates) so the photographer can
// weed them out before clients see them. The measuring happens in the
// photographer's browser (free); these are the pure calculations, tested in
// culling.test.ts.

// What we store per photo after checking it.
export type CullMetrics = {
  // Version 3 added the highlight/shadow percentiles (older results are re-checked).
  v: 3;
  // Sharpness of the sharpest parts of the photo (so a soft background
  // behind a sharp subject still counts as sharp).
  sharpness: number;
  // Average brightness, 0 (black) to 1 (white).
  brightness: number;
  // Share of pixels that are nearly black / nearly white.
  darkClip: number;
  brightClip: number;
  // How bright the brightest 10% and the darkest 10% of the photo are. A
  // black-background (low-key) portrait has a bright subject, so its p90 is
  // high even though its average is low; a truly underexposed photo is dim
  // all the way up.
  p10: number;
  p90: number;
  // The darkest 1% and brightest 1%: whether the photo has any real shadows
  // or highlights at all. Well-exposed low-key portraits on dark backdrops
  // (Elle's gallery, 2026-09-27: p90 as low as 0.19) still have highlights
  // (white shirts, jewelry, catchlights); an underexposed photo has none.
  p1: number;
  p99: number;
  // 64-bit "fingerprint" (16 hex characters) for spotting near-duplicates.
  hash: string;
  // Faces found, and how many of them have both eyes closed (null = not checked).
  faces: number | null;
  eyesClosed: number | null;
};

export const CULL_FLAGS = ["blurry", "dark", "bright", "eyes", "duplicate"] as const;
export type CullFlag = (typeof CULL_FLAGS)[number];

export const CULL_LABELS: Record<CullFlag, string> = {
  blurry: "Blurry",
  dark: "Too dark",
  bright: "Too bright",
  eyes: "Closed eyes",
  duplicate: "Near-duplicate",
};

// ---- Measuring (from grayscale pixels, values 0..1, row by row) ----

export function toGray(rgba: Uint8ClampedArray | Uint8Array): Float32Array {
  const gray = new Float32Array(rgba.length / 4);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    gray[p] = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255;
  }
  return gray;
}

// Laplacian variance per tile (a 6×6 grid); sharpness is the mean of the
// three sharpest tiles, scaled to a friendly range.
export function sharpness(gray: Float32Array, width: number, height: number, grid = 6) {
  const tiles: number[] = [];
  const tw = Math.floor(width / grid);
  const th = Math.floor(height / grid);
  if (tw < 4 || th < 4) return 0;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let y = Math.max(1, gy * th); y < Math.min(height - 1, (gy + 1) * th); y++) {
        for (let x = Math.max(1, gx * tw); x < Math.min(width - 1, (gx + 1) * tw); x++) {
          const i = y * width + x;
          const lap = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
          sum += lap;
          sumSq += lap * lap;
          n++;
        }
      }
      if (n > 0) tiles.push(sumSq / n - (sum / n) ** 2);
    }
  }
  tiles.sort((a, b) => b - a);
  const top = tiles.slice(0, 3);
  return (top.reduce((s, v) => s + v, 0) / top.length) * 10000;
}

export function exposure(gray: Float32Array) {
  let sum = 0;
  let dark = 0;
  let bright = 0;
  const histogram = new Uint32Array(256);
  for (const v of gray) {
    sum += v;
    if (v < 0.04) dark++;
    else if (v > 0.97) bright++;
    histogram[Math.min(255, Math.max(0, Math.round(v * 255)))]++;
  }
  const n = gray.length || 1;
  const percentile = (share: number) => {
    let seen = 0;
    for (let i = 0; i < 256; i++) {
      seen += histogram[i];
      if (seen >= share * n) return i / 255;
    }
    return 1;
  };
  return {
    brightness: sum / n,
    darkClip: dark / n,
    brightClip: bright / n,
    p1: percentile(0.01),
    p10: percentile(0.1),
    p90: percentile(0.9),
    p99: percentile(0.99),
  };
}

// Difference hash from a 9×8 grayscale thumbnail: each bit says whether a
// pixel is brighter than its right-hand neighbor.
export function differenceHash(gray9x8: ArrayLike<number>) {
  let hex = "";
  for (let row = 0; row < 8; row++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) {
      const i = row * 9 + col;
      byte = (byte << 1) | (gray9x8[i] > gray9x8[i + 1] ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function hammingDistance(a: string, b: string) {
  let distance = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

// ---- Flagging a gallery ----

// Photos this many bits apart (of 64) or fewer look like the same shot.
const DUPLICATE_BITS = 8;
// Blurry: under this share of the gallery's typical sharpness, or under the
// floor. Measured 2026-09-27 on real photos at the 640px working size: sharp
// ≈ 2,000; a 2px Gaussian blur at full size 116–409; 4px 13–63; 8px 1.5–8.
const BLUR_SHARE = 0.2;
const BLUR_FLOOR = 60;

export type CullInput = { id: string; cull: CullMetrics | null };
export type CullResult = {
  flags: Map<string, CullFlag[]>;
  // Near-duplicate sets, sharpest first.
  duplicateSets: string[][];
  checked: number;
  unchecked: number;
};

export function cullGallery(photos: CullInput[]): CullResult {
  const checked = photos.filter((p): p is { id: string; cull: CullMetrics } => p.cull !== null);
  const flags = new Map<string, CullFlag[]>(photos.map((p) => [p.id, []]));
  const add = (id: string, flag: CullFlag) => flags.get(id)!.push(flag);

  const sorted = checked.map((p) => p.cull.sharpness).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  for (const { id, cull } of checked) {
    if (cull.sharpness < BLUR_FLOOR || (checked.length >= 4 && cull.sharpness < median * BLUR_SHARE)) add(id, "blurry");
    // Too dark: no real highlights anywhere, so dark backdrops and deeper
    // skin tones never count against a photo. Too bright: no real shadows.
    if (cull.p99 < 0.4 && cull.p90 < 0.25) add(id, "dark");
    if (cull.p1 > 0.6 && cull.p10 > 0.8) add(id, "bright");
    if (cull.eyesClosed !== null && cull.eyesClosed > 0) add(id, "eyes");
  }

  // Near-duplicates: group photos whose fingerprints are close (union-find).
  const parent = checked.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < checked.length; i++) {
    for (let j = i + 1; j < checked.length; j++) {
      if (hammingDistance(checked[i].cull.hash, checked[j].cull.hash) <= DUPLICATE_BITS) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, typeof checked>();
  checked.forEach((p, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), p]));
  const duplicateSets = [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => b.cull.sharpness - a.cull.sharpness).map((p) => p.id));
  for (const set of duplicateSets) for (const id of set) add(id, "duplicate");

  return { flags, duplicateSets, checked: checked.length, unchecked: photos.length - checked.length };
}

// Checks a stored value really is metrics we wrote (the database holds JSON).
export function isCullMetrics(value: unknown): value is CullMetrics {
  const v = value as CullMetrics;
  return (
    !!v &&
    v.v === 3 &&
    [v.sharpness, v.brightness, v.darkClip, v.brightClip, v.p1, v.p10, v.p90, v.p99].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    typeof v.hash === "string" &&
    /^[0-9a-f]{16}$/.test(v.hash) &&
    (v.faces === null || Number.isInteger(v.faces)) &&
    (v.eyesClosed === null || Number.isInteger(v.eyesClosed))
  );
}
