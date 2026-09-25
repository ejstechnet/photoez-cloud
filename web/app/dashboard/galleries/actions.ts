"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, inArray, max, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clients, galleries, photographers, photos } from "@/db/schema";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_BATCH, PHOTO_KINDS, PHOTO_TYPES } from "@/lib/photo-limits";
import { staleProof } from "@/lib/proofs";
import { GALLERY_STATUSES, type GalleryStatus } from "@/lib/gallery-status";
import { requirePhotographer } from "@/lib/session";
import { studioPlan } from "@/lib/studio-plan";
import {
  deletePrefix,
  galleryHeaderKey,
  galleryHeaderSourceKey,
  galleryPrefix,
  headerSourceVersion,
  photoKey,
  photoPrefix,
  signedUploadUrl,
  signedViewUrl,
  storedSize,
} from "@/lib/storage";

// Server actions for galleries and their photos. Each one re-checks who is
// logged in and only touches galleries that photographer owns.

const isUuid = (value: string) => z.uuid().safeParse(value).success;

async function findOwnedGallery(galleryId: string, photographerId: string) {
  if (!isUuid(galleryId)) return null;
  const [gallery] = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.photographerId, photographerId)));
  return gallery ?? null;
}

// ---- Galleries ----

const gallerySchema = z.object({
  title: z.string().trim().min(1, "Give the gallery a title.").max(200, "Keep the title under 200 characters."),
  freeLimit: z.coerce
    .number({ message: "Enter a number." })
    .int("Enter a whole number.")
    .min(0, "Use 0 or more.")
    .max(10_000, "That's more photos than a gallery can hold."),
  clientId: z
    .string()
    .trim()
    .refine((value) => value === "" || isUuid(value), "Choose a client from the list.")
    .transform((value) => value || null),
  // Dollars; blank = the studio's price per extra photo.
  extraPhotoPrice: z
    .string()
    .trim()
    .transform((value) => value.replace(/[$,]/g, ""))
    .refine((value) => value === "" || /^\d{1,5}(\.\d{1,2})?$/.test(value), "Enter a price like 10 or 10.00, or leave it blank.")
    .transform((value) => (value === "" ? null : Math.round(Number(value) * 100))),
});

export type GalleryFormState = {
  errors?: Partial<Record<keyof z.input<typeof gallerySchema>, string>>;
  message?: string;
};

type ParsedGallery =
  | { ok: true; data: Omit<z.output<typeof gallerySchema>, "extraPhotoPrice"> & { extraPhotoPriceCents?: number | null } }
  | { ok: false; state: GalleryFormState };

async function parseGallery(formData: FormData, photographerId: string): Promise<ParsedGallery> {
  const parsed = gallerySchema.safeParse({
    title: String(formData.get("title") ?? ""),
    freeLimit: formData.get("freeLimit") ?? "",
    clientId: String(formData.get("clientId") ?? ""),
    extraPhotoPrice: String(formData.get("extraPhotoPrice") ?? ""),
  });
  if (!parsed.success) {
    const errors: GalleryFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof z.input<typeof gallerySchema>;
      errors[field] ??= issue.message;
    }
    return { ok: false, state: { errors } };
  }
  // The chosen client must belong to this photographer too.
  if (parsed.data.clientId) {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, parsed.data.clientId), eq(clients.photographerId, photographerId)));
    if (!client) return { ok: false, state: { errors: { clientId: "Choose a client from the list." } } };
  }
  // Only plans with gallery upsells can set a gallery's extra photo price.
  const { extraPhotoPrice, ...rest } = parsed.data;
  const { upsells } = await studioPlan(photographerId);
  return { ok: true, data: { ...rest, ...(upsells ? { extraPhotoPriceCents: extraPhotoPrice } : {}) } };
}

export async function createGallery(_prev: GalleryFormState, formData: FormData): Promise<GalleryFormState> {
  const photographer = await requirePhotographer();
  const result = await parseGallery(formData, photographer.id);
  if (!result.ok) return result.state;

  const [gallery] = await db
    .insert(galleries)
    .values({
      ...result.data,
      photographerId: photographer.id,
      // Unguessable token for the client's private gallery link.
      shareToken: randomBytes(18).toString("base64url"),
    })
    .returning({ id: galleries.id });

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/galleries/${gallery.id}`);
}

export async function updateGallery(
  galleryId: string,
  _prev: GalleryFormState,
  formData: FormData,
): Promise<GalleryFormState> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { message: "That gallery could not be found." };

  const result = await parseGallery(formData, photographer.id);
  if (!result.ok) return result.state;

  await db.update(galleries).set(result.data).where(eq(galleries.id, galleryId));

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/galleries/${galleryId}`);
}

export async function deleteGallery(galleryId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (await findOwnedGallery(galleryId, photographer.id)) {
    // Remove the files first, so a failure never leaves orphaned photos in storage.
    await deletePrefix(galleryPrefix(photographer.id, galleryId));
    await db.delete(galleries).where(eq(galleries.id, galleryId));
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/galleries");
}

// Let the client change their picks again after submitting.
// Opens selections back up from any later stage (submitted, delivered,
// completed, expired), like PhotoEZ for WordPress. A delivered gallery's link
// goes back to proofing until it's delivered again; picks and finals are kept.
export async function reopenProofing(galleryId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (await findOwnedGallery(galleryId, photographer.id)) {
    await db
      .update(galleries)
      .set({ status: "pending", submittedAt: null, deliveredAt: null })
      .where(and(eq(galleries.id, galleryId), ne(galleries.status, "pending")));
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/g/[token]", "page");
}

// Sets a gallery's status by hand, like PhotoEZ for WordPress's status
// dropdown. The dates that go with each stage are kept consistent.
export async function setGalleryStatus(galleryId: string, status: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { error: "That gallery could not be found." };
  if (!(GALLERY_STATUSES as readonly string[]).includes(status)) return { error: "Pick a status from the list." };
  const next = status as GalleryStatus;

  if (next === "delivered" || next === "completed") {
    const [{ finals }] = await db
      .select({ finals: count() })
      .from(photos)
      .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, "final")));
    if (finals === 0) return { error: "Upload final photos before marking the gallery delivered." };
  }

  const now = new Date();
  const dates =
    next === "pending"
      ? { submittedAt: null, deliveredAt: null }
      : next === "submitted" || next === "paid_and_submitted"
        ? { submittedAt: sql`coalesce(${galleries.submittedAt}, ${now})`, deliveredAt: null }
        : next === "delivered" || next === "completed"
          ? { deliveredAt: sql`coalesce(${galleries.deliveredAt}, ${now})` }
          : {};
  await db.update(galleries).set({ status: next, ...dates }).where(eq(galleries.id, galleryId));
  revalidatePath("/dashboard", "layout");
  revalidatePath("/g/[token]", "page");
  return { ok: true };
}

// "Delete all" for a gallery's proofs or finals: every file in storage and
// every photo row (the client's hearts on proofs go with them).
export async function deleteAllPhotos(galleryId: string, kind: "proof" | "final"): Promise<void> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return;
  if (kind !== "proof" && kind !== "final") return;

  const rows = await db
    .select({ id: photos.id, fileKey: photos.fileKey })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, kind)));
  for (const photo of rows) await deletePrefix(`${photo.fileKey}/`);
  if (rows.length > 0) {
    await db.delete(photos).where(and(eq(photos.galleryId, galleryId), eq(photos.kind, kind)));
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath("/g/[token]", "page");
}

// Send the finals to the client: their link switches to the delivery page.
// Works from any stage, so photographers who skip proofing (e.g. events) can
// deliver directly.
export async function deliverGallery(galleryId: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { error: "That gallery could not be found." };

  const [{ finals }] = await db
    .select({ finals: count() })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, "final")));
  if (finals === 0) return { error: "Upload your final photos before delivering." };

  await db.update(galleries).set({ status: "delivered", deliveredAt: new Date() }).where(eq(galleries.id, galleryId));
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Take a delivery back (e.g. delivered too soon). The client returns to
// "Submitted" if they had submitted picks, otherwise to proofing.
export async function undoDelivery(galleryId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (await findOwnedGallery(galleryId, photographer.id)) {
    await db
      .update(galleries)
      .set({
        status: sql`case when ${galleries.submittedAt} is null then 'pending' else 'submitted' end`,
        deliveredAt: null,
      })
      .where(and(eq(galleries.id, galleryId), eq(galleries.status, "delivered")));
  }
  revalidatePath("/dashboard", "layout");
}

// ---- Photo uploads ----
// 1. prepareUploads: the browser describes the files; we return one-time
//    upload links (original, preview, thumbnail) for each photo.
// 2. The browser uploads straight to R2 using those links.
// 3. confirmUpload: we check the files really arrived, then save the photo.

const fileInfoSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(PHOTO_TYPES, { message: "Only JPEG, PNG, and WebP photos can be uploaded." }),
  size: z.number().int().positive().max(MAX_PHOTO_BYTES, "Photos must be 50 MB or smaller."),
});

export type PreparedUpload = {
  photoId: string;
  urls: { original: string; preview: string; thumb: string; proof: string };
};

export async function prepareUploads(
  galleryId: string,
  // Plain strings on purpose: this comes from the browser, and Zod checks it below.
  files: { name: string; type: string; size: number }[],
): Promise<{ uploads: PreparedUpload[] } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { error: "That gallery could not be found." };

  const parsed = z.array(fileInfoSchema).min(1).max(MAX_PHOTOS_PER_BATCH).safeParse(files);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Those files can't be uploaded." };

  const uploads = await Promise.all(
    parsed.data.map(async (file) => {
      const photoId = randomUUID();
      const prefix = photoPrefix(photographer.id, galleryId, photoId);
      return {
        photoId,
        urls: {
          original: await signedUploadUrl(photoKey(prefix, "original"), file.type),
          preview: await signedUploadUrl(photoKey(prefix, "preview"), "image/jpeg"),
          thumb: await signedUploadUrl(photoKey(prefix, "thumb"), "image/jpeg"),
          proof: await signedUploadUrl(photoKey(prefix, "proof"), "image/jpeg"),
        },
      };
    }),
  );
  return { uploads };
}

const confirmSchema = z.object({
  photoId: z.uuid(),
  originalName: z.string().min(1).max(255),
  contentType: z.enum(PHOTO_TYPES),
  width: z.number().int().positive().max(100_000),
  height: z.number().int().positive().max(100_000),
  kind: z.enum(PHOTO_KINDS),
  // True when the browser also uploaded a watermarked proof (proofs only).
  hasProof: z.boolean(),
});

export async function confirmUpload(
  galleryId: string,
  photo: z.input<typeof confirmSchema>,
): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { error: "That gallery could not be found." };

  const parsed = confirmSchema.safeParse(photo);
  if (!parsed.success) return { error: "That upload couldn't be saved." };
  const hasProof = parsed.data.kind === "proof" && parsed.data.hasProof;

  const prefix = photoPrefix(photographer.id, galleryId, parsed.data.photoId);
  const [originalSize, previewSize, thumbSize, proofSize] = await Promise.all([
    storedSize(photoKey(prefix, "original")),
    storedSize(photoKey(prefix, "preview")),
    storedSize(photoKey(prefix, "thumb")),
    hasProof ? storedSize(photoKey(prefix, "proof")) : Promise.resolve(0),
  ]);
  if (originalSize === null || previewSize === null || thumbSize === null || proofSize === null) {
    return { error: "The upload didn't finish. Try that photo again." };
  }
  if (originalSize > MAX_PHOTO_BYTES) {
    await deletePrefix(`${prefix}/`);
    return { error: "Photos must be 50 MB or smaller." };
  }

  const [{ lastPosition }] = await db
    .select({ lastPosition: max(photos.position) })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, parsed.data.kind)));

  await db
    .insert(photos)
    .values({
      id: parsed.data.photoId,
      galleryId,
      kind: parsed.data.kind,
      fileKey: prefix,
      originalName: parsed.data.originalName,
      contentType: parsed.data.contentType,
      width: parsed.data.width,
      height: parsed.data.height,
      sizeBytes: originalSize,
      position: (lastPosition ?? 0) + 1,
      proofMadeAt: hasProof ? new Date() : null,
    })
    .onConflictDoNothing();

  return { ok: true };
}

// ---- Updating proofs after the watermark changes ----
// The browser downloads each clean preview, stamps the current watermark on
// it, and uploads the new proof; then markProofsMade records the change.

const REFRESH_BATCH = 20;

export type ProofJob = { photoId: string; previewUrl: string; proofUploadUrl: string };

export async function prepareProofRefresh(
  galleryId: string,
): Promise<{ jobs: ProofJob[]; remaining: number } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { error: "That gallery could not be found." };

  const [settings] = await db
    .select({ key: photographers.watermarkKey, updatedAt: photographers.watermarkUpdatedAt })
    .from(photographers)
    .where(eq(photographers.id, photographer.id));
  if (!settings?.key) return { error: "Add a watermark in Settings first." };

  const stale = await db
    .select({ id: photos.id, fileKey: photos.fileKey })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), eq(photos.kind, "proof"), staleProof(settings.updatedAt)))
    .orderBy(photos.position);

  const jobs = await Promise.all(
    stale.slice(0, REFRESH_BATCH).map(async (photo) => ({
      photoId: photo.id,
      previewUrl: await signedViewUrl(photoKey(photo.fileKey, "preview")),
      proofUploadUrl: await signedUploadUrl(photoKey(photo.fileKey, "proof"), "image/jpeg"),
    })),
  );
  return { jobs, remaining: stale.length };
}

export async function markProofsMade(galleryId: string, photoIds: string[]): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { error: "That gallery could not be found." };
  const ids = z.array(z.uuid()).max(REFRESH_BATCH).safeParse(photoIds);
  if (!ids.success || ids.data.length === 0) return { ok: true };

  await db
    .update(photos)
    .set({ proofMadeAt: new Date() })
    .where(and(eq(photos.galleryId, galleryId), inArray(photos.id, ids.data)));
  revalidatePath(`/dashboard/galleries/${galleryId}`);
  return { ok: true };
}

export async function deletePhoto(galleryId: string, photoId: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id)) || !isUuid(photoId)) {
    return { error: "That photo could not be found." };
  }

  const [photo] = await db
    .select({ fileKey: photos.fileKey })
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.galleryId, galleryId)));
  if (!photo) return { error: "That photo could not be found." };

  await deletePrefix(`${photo.fileKey}/`);
  await db.delete(photos).where(eq(photos.id, photoId));

  revalidatePath(`/dashboard/galleries/${galleryId}`);
  return { ok: true };
}

// ---- Header image (top of the client's gallery page) ----
// The browser crops the banner (and, for a new photo, keeps a resized
// original for re-cropping), uploads both straight to storage, then
// saveGalleryHeader checks they arrived and swaps them in.

const MAX_HEADER_BYTES = 8 * 1024 * 1024;
const VERSION = /^[a-f0-9]{12}$/;

async function currentHeaderKey(galleryId: string) {
  const [row] = await db.select({ key: galleries.headerImageKey }).from(galleries).where(eq(galleries.id, galleryId));
  return row?.key ?? null;
}

export async function prepareGalleryHeaderUpload(
  galleryId: string,
  sizes: { source: number | null; banner: number },
): Promise<
  { source: string; crop: string; sourceUrl: string | null; bannerUrl: string } | { error: string }
> {
  const photographer = await requirePhotographer();
  const gallery = await findOwnedGallery(galleryId, photographer.id);
  if (!gallery) return { error: "That gallery could not be found." };
  if (sizes.banner > MAX_HEADER_BYTES || (sizes.source ?? 0) > MAX_HEADER_BYTES) {
    return { error: "That photo is too large. Try a smaller one." };
  }
  // Re-cropping reuses the kept original; a new photo gets a new one.
  let source: string;
  if (sizes.source === null) {
    const key = await currentHeaderKey(gallery.id);
    const existing = key ? headerSourceVersion(key) : null;
    if (!existing) return { error: "Choose the photo again to crop it." };
    source = existing;
  } else {
    source = randomBytes(6).toString("hex");
  }
  const crop = randomBytes(6).toString("hex");
  return {
    source,
    crop,
    sourceUrl:
      sizes.source === null
        ? null
        : await signedUploadUrl(galleryHeaderSourceKey(photographer.id, gallery.id, source), "image/jpeg"),
    bannerUrl: await signedUploadUrl(galleryHeaderKey(photographer.id, gallery.id, source, crop), "image/jpeg"),
  };
}

export async function saveGalleryHeader(
  galleryId: string,
  source: string,
  crop: string,
): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  const gallery = await findOwnedGallery(galleryId, photographer.id);
  if (!gallery || !VERSION.test(source) || !VERSION.test(crop)) return { error: "That upload couldn't be saved." };
  const bannerKey = galleryHeaderKey(photographer.id, gallery.id, source, crop);
  const sourceKey = galleryHeaderSourceKey(photographer.id, gallery.id, source);
  const [bannerSize, sourceSize] = await Promise.all([storedSize(bannerKey), storedSize(sourceKey)]);
  if (bannerSize === null || sourceSize === null) return { error: "The photo upload didn't finish. Try again." };
  if (bannerSize > MAX_HEADER_BYTES || sourceSize > MAX_HEADER_BYTES) {
    await deletePrefix(bannerKey);
    return { error: "That photo is too large. Try a smaller one." };
  }

  // Clear out the old banner, and the old original if this is a new photo.
  const old = await currentHeaderKey(gallery.id);
  if (old && old !== bannerKey) {
    await deletePrefix(old);
    const oldSource = headerSourceVersion(old);
    if (oldSource && oldSource !== source) {
      await deletePrefix(galleryHeaderSourceKey(photographer.id, gallery.id, oldSource));
    }
  }
  await db.update(galleries).set({ headerImageKey: bannerKey }).where(eq(galleries.id, gallery.id));
  revalidatePath("/dashboard/galleries", "layout");
  revalidatePath("/g/[token]", "page");
  return { ok: true };
}

export async function removeGalleryHeader(galleryId: string): Promise<void> {
  const photographer = await requirePhotographer();
  const gallery = await findOwnedGallery(galleryId, photographer.id);
  if (!gallery) return;
  const current = await currentHeaderKey(gallery.id);
  if (current) {
    await deletePrefix(current);
    const source = headerSourceVersion(current);
    if (source) await deletePrefix(galleryHeaderSourceKey(photographer.id, gallery.id, source));
  }
  await db.update(galleries).set({ headerImageKey: null }).where(eq(galleries.id, gallery.id));
  revalidatePath("/dashboard/galleries", "layout");
  revalidatePath("/g/[token]", "page");
}

// Rename from the gallery page, without opening Settings.
export async function renameGallery(galleryId: string, title: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { error: "That gallery could not be found." };
  const clean = title.trim();
  if (!clean) return { error: "Give the gallery a title." };
  if (clean.length > 200) return { error: "Keep the title under 200 characters." };
  await db.update(galleries).set({ title: clean }).where(eq(galleries.id, galleryId));
  revalidatePath("/dashboard", "layout");
  revalidatePath("/g/[token]", "page");
  return { ok: true };
}
