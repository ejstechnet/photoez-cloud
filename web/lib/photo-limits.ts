// Upload rules shared by the browser uploader and the server actions.
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export const MAX_PHOTOS_PER_BATCH = 100;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_KINDS = ["proof", "final"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
