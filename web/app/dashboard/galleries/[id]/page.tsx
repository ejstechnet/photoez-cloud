import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, galleries, photos } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { z } from "zod";
import { StatusPill } from "../status-pill";
import { PhotoTile } from "./photo-tile";
import { Uploader } from "./uploader";

export default async function GalleryPage({ params }: PageProps<"/dashboard/galleries/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [gallery] = await db
    .select({ id: galleries.id, title: galleries.title, status: galleries.status, clientName: clients.name })
    .from(galleries)
    .leftJoin(clients, eq(clients.id, galleries.clientId))
    .where(and(eq(galleries.id, id), eq(galleries.photographerId, user.id)));
  if (!gallery) notFound();

  const rows = await db
    .select({ id: photos.id, fileKey: photos.fileKey, originalName: photos.originalName })
    .from(photos)
    .where(eq(photos.galleryId, gallery.id))
    .orderBy(asc(photos.position));

  const tiles = await Promise.all(
    rows.map(async (photo) => ({
      id: photo.id,
      name: photo.originalName,
      thumbUrl: await signedViewUrl(photoKey(photo.fileKey, "thumb")),
      previewUrl: await signedViewUrl(photoKey(photo.fileKey, "preview")),
    })),
  );

  return (
    <>
      <Link
        href="/dashboard/galleries"
        className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
      >
        ← All galleries
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <StatusPill status={gallery.status} />
            <span className="text-sm font-semibold text-muted">{gallery.clientName ?? "No client"}</span>
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight break-words sm:text-5xl">
            {gallery.title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* PhotoEZ-style round counter */}
          <div className="flex size-16 flex-col items-center justify-center rounded-full bg-brand text-white ring-4 ring-lime/40">
            <span className="font-display text-xl leading-none font-bold">{tiles.length}</span>
            <span className="mt-0.5 text-[9px] font-bold tracking-wider uppercase">photos</span>
          </div>
          <Link href={`/dashboard/galleries/${gallery.id}/edit`} className="btn-secondary">
            Settings
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <Uploader galleryId={gallery.id} />
      </div>

      {tiles.length > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((tile, i) => (
            <li key={tile.id}>
              <PhotoTile galleryId={gallery.id} number={i + 1} {...tile} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
