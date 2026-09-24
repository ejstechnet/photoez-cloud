"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clients, galleries, photos } from "@/db/schema";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_BATCH, PHOTO_TYPES } from "@/lib/photo-limits";
import { requirePhotographer } from "@/lib/session";
import {
  deletePrefix,
  galleryPrefix,
  photoKey,
  photoPrefix,
  signedUploadUrl,
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
  clientId: z
    .string()
    .trim()
    .refine((value) => value === "" || isUuid(value), "Choose a client from the list.")
    .transform((value) => value || null),
});

export type GalleryFormState = {
  errors?: Partial<Record<keyof z.input<typeof gallerySchema>, string>>;
  message?: string;
};

type ParsedGallery =
  | { ok: true; data: z.output<typeof gallerySchema> }
  | { ok: false; state: GalleryFormState };

async function parseGallery(formData: FormData, photographerId: string): Promise<ParsedGallery> {
  const parsed = gallerySchema.safeParse({
    title: String(formData.get("title") ?? ""),
    clientId: String(formData.get("clientId") ?? ""),
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
  return { ok: true, data: parsed.data };
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
  urls: { original: string; preview: string; thumb: string };
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
});

export async function confirmUpload(
  galleryId: string,
  photo: z.input<typeof confirmSchema>,
): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  if (!(await findOwnedGallery(galleryId, photographer.id))) return { error: "That gallery could not be found." };

  const parsed = confirmSchema.safeParse(photo);
  if (!parsed.success) return { error: "That upload couldn't be saved." };

  const prefix = photoPrefix(photographer.id, galleryId, parsed.data.photoId);
  const [originalSize, previewSize, thumbSize] = await Promise.all([
    storedSize(photoKey(prefix, "original")),
    storedSize(photoKey(prefix, "preview")),
    storedSize(photoKey(prefix, "thumb")),
  ]);
  if (originalSize === null || previewSize === null || thumbSize === null) {
    return { error: "The upload didn't finish. Try that photo again." };
  }
  if (originalSize > MAX_PHOTO_BYTES) {
    await deletePrefix(`${prefix}/`);
    return { error: "Photos must be 50 MB or smaller." };
  }

  const [{ lastPosition }] = await db
    .select({ lastPosition: max(photos.position) })
    .from(photos)
    .where(eq(photos.galleryId, galleryId));

  await db
    .insert(photos)
    .values({
      id: parsed.data.photoId,
      galleryId,
      fileKey: prefix,
      originalName: parsed.data.originalName,
      contentType: parsed.data.contentType,
      width: parsed.data.width,
      height: parsed.data.height,
      sizeBytes: originalSize,
      position: (lastPosition ?? 0) + 1,
    })
    .onConflictDoNothing();

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
