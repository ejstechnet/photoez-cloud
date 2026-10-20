// Upload rules shared by the browser uploader and the server actions.
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
// Most photos one server request will hand out upload links for.
export const MAX_PHOTOS_PER_BATCH = 100;
// Most photos one drop or "Choose photos" can take. The uploader asks for links
// a few at a time (UPLOAD_CHUNK), right before using them, because each link
// expires 15 minutes after it's made (lib/storage.ts). Raised from 100 for
// Elle, 2026-10-19: most shoots are 300+ photos.
export const MAX_PHOTOS_PER_UPLOAD = 1000;
export const UPLOAD_CHUNK = 10;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_KINDS = ["proof", "final"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
