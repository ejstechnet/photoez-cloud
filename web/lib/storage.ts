import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// All photo storage goes through this file. It speaks the S3 API, so moving
// from Cloudflare R2 to another S3-compatible service only means changing the
// R2_* settings in .env. The database stores key prefixes, never URLs.

const bucket = process.env.R2_BUCKET!;

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Each photo is stored under one prefix: the untouched original, a ~2000px
// clean preview, a ~900px thumbnail for grids, and (when the photographer has
// a watermark) a watermarked proof — the only version clients see while proofing.
export type PhotoVariant = "original" | "preview" | "thumb" | "proof";

// A new key each time the watermark is replaced, so browsers never show a cached old one.
export function watermarkKey(photographerId: string, version: string) {
  return `photographers/${photographerId}/branding/watermark-${version}.png`;
}

// The studio logo shown on the public studio page. A new key per upload, so
// browsers never show a cached old logo.
export function studioLogoKey(photographerId: string, version: string, extension: string) {
  return `photographers/${photographerId}/branding/logo-${version}.${extension}`;
}

// The photo shown above a session on the booking page. A new key per upload,
// so browsers never show a cached old photo.
export function sessionImageKey(photographerId: string, sessionTypeId: string, version: string) {
  return `photographers/${photographerId}/sessions/${sessionTypeId}-${version}.jpg`;
}

// The photo shown on an add-on card in the booking flow.
export function addonImageKey(photographerId: string, addonId: string, version: string) {
  return `photographers/${photographerId}/addons/${addonId}-${version}.jpg`;
}

// Inspiration photos a client uploads while booking. `batch` is random per
// upload, so one client can't guess or overwrite another's files.
export function inspoKey(photographerId: string, batch: string, index: number) {
  return `photographers/${photographerId}/inspo/${batch}/${index}.jpg`;
}

export function photoPrefix(photographerId: string, galleryId: string, photoId: string) {
  return `photographers/${photographerId}/galleries/${galleryId}/photos/${photoId}`;
}

export function galleryPrefix(photographerId: string, galleryId: string) {
  return `photographers/${photographerId}/galleries/${galleryId}/`;
}

// The large banner across the top of the client's gallery page, cropped from
// a kept original so it can be re-cropped later (like PhotoEZ for WordPress).
// Both live in the gallery's folder, so deleting the gallery deletes them too.
// Names: header-<source>-<crop>.jpg (the banner) and header-<source>-source.jpg.
export function galleryHeaderKey(photographerId: string, galleryId: string, source: string, crop: string) {
  return `${galleryPrefix(photographerId, galleryId)}header-${source}-${crop}.jpg`;
}

export function galleryHeaderSourceKey(photographerId: string, galleryId: string, source: string) {
  return `${galleryPrefix(photographerId, galleryId)}header-${source}-source.jpg`;
}

// The original's version from a banner key; null for banners saved before cropping existed.
export function headerSourceVersion(headerKey: string) {
  return /\/header-([a-f0-9]{12})-[a-f0-9]{12}\.jpg$/.exec(headerKey)?.[1] ?? null;
}

export function photoKey(prefix: string, variant: PhotoVariant) {
  return variant === "original" ? `${prefix}/original` : `${prefix}/${variant}.jpg`;
}

// A short-lived link the browser can upload one file to, directly.
export function signedUploadUrl(key: string, contentType: string) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: 15 * 60,
  });
}

// A short-lived link to view (or download) a private file. Links are signed as
// of the start of the current hour, so the same photo gets the same link for
// the whole hour and the browser can cache it.
export function signedViewUrl(key: string, options: { downloadAs?: string } = {}) {
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: options.downloadAs
        ? `attachment; filename="${options.downloadAs.replace(/["\\\r\n]/g, "")}"`
        : undefined,
    }),
    { expiresIn: 2 * 60 * 60, signingDate: hourStart },
  );
}

// Size in bytes of a stored file, or null if it doesn't exist.
export async function storedSize(key: string): Promise<number | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? 0;
  } catch (error) {
    if (error instanceof Error && (error.name === "NotFound" || error.name === "NoSuchKey")) return null;
    throw error;
  }
}

// Delete every file whose key starts with `prefix` (e.g. a whole gallery).
export async function deletePrefix(prefix: string) {
  let continuationToken: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    const keys = (page.Contents ?? []).map((object) => ({ Key: object.Key! }));
    if (keys.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
}
