"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { galleries } from "@/db/schema";
import { hasFeature } from "@/lib/plans";
import { requirePhotographer } from "@/lib/session";
import { MAX_SONG_BYTES, SONG_CONTENT_TYPE, checkSong, songTitle } from "@/lib/slideshow";
import { deletePrefix, gallerySongKey, signedUploadUrl, storedSize } from "@/lib/storage";
import { studioPlan } from "@/lib/studio-plan";

// A gallery's slideshow (Pro and Studio): turn it on or off, and the song.
// The browser uploads the song straight to storage with a short-lived link,
// then saveSlideshowSong checks it arrived and swaps it in.

const VERSION = /^[a-f0-9]{12}$/;

async function ownedGallery(galleryId: string) {
  const photographer = await requirePhotographer();
  if (!/^[0-9a-f-]{36}$/i.test(galleryId)) return null;
  const [gallery] = await db
    .select({ id: galleries.id, songKey: galleries.slideshowSongKey })
    .from(galleries)
    .where(and(eq(galleries.id, galleryId), eq(galleries.photographerId, photographer.id)));
  if (!gallery) return null;
  const { plan } = await studioPlan(photographer.id);
  return { ...gallery, photographerId: photographer.id, allowed: hasFeature(plan, "slideshow") };
}

const refresh = () => {
  revalidatePath("/dashboard/galleries", "layout");
  revalidatePath("/g/[token]", "page");
};

export async function setSlideshowEnabled(galleryId: string, enabled: boolean): Promise<{ error?: string }> {
  const gallery = await ownedGallery(galleryId);
  if (!gallery) return { error: "That gallery could not be found." };
  if (!gallery.allowed) return { error: "Slideshows are on the Pro and Studio plans." };
  await db.update(galleries).set({ slideshowEnabled: enabled }).where(eq(galleries.id, gallery.id));
  refresh();
  return {};
}

export async function prepareSlideshowSong(
  galleryId: string,
  file: { type: string; name: string; size: number },
): Promise<{ version: string; extension: string; contentType: string; uploadUrl: string } | { error: string }> {
  const gallery = await ownedGallery(galleryId);
  if (!gallery) return { error: "That gallery could not be found." };
  if (!gallery.allowed) return { error: "Slideshows are on the Pro and Studio plans." };
  const checked = checkSong(file);
  if ("error" in checked) return checked;
  const version = randomBytes(6).toString("hex");
  const contentType = SONG_CONTENT_TYPE[checked.extension];
  return {
    version,
    extension: checked.extension,
    contentType,
    uploadUrl: await signedUploadUrl(gallerySongKey(gallery.photographerId, gallery.id, version, checked.extension), contentType),
  };
}

export async function saveSlideshowSong(galleryId: string, version: string, extension: string, fileName: string): Promise<{ error?: string }> {
  const gallery = await ownedGallery(galleryId);
  if (!gallery || !VERSION.test(version) || !(extension in SONG_CONTENT_TYPE)) return { error: "That song couldn't be saved." };
  const key = gallerySongKey(gallery.photographerId, gallery.id, version, extension);
  const size = await storedSize(key);
  if (size === null) return { error: "The upload didn't finish. Try again." };
  if (size > MAX_SONG_BYTES) {
    await deletePrefix(key);
    return { error: "That song is too large (60 MB at most)." };
  }
  if (gallery.songKey && gallery.songKey !== key) await deletePrefix(gallery.songKey);
  await db
    .update(galleries)
    .set({ slideshowSongKey: key, slideshowSongName: songTitle(fileName) })
    .where(eq(galleries.id, gallery.id));
  refresh();
  return {};
}

export async function removeSlideshowSong(galleryId: string): Promise<{ error?: string }> {
  const gallery = await ownedGallery(galleryId);
  if (!gallery) return { error: "That gallery could not be found." };
  if (gallery.songKey) await deletePrefix(gallery.songKey);
  await db.update(galleries).set({ slideshowSongKey: null, slideshowSongName: null }).where(eq(galleries.id, gallery.id));
  refresh();
  return {};
}
