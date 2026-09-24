import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, favorites, galleries, photos } from "@/db/schema";
import { getWatermarkSettings, staleProof } from "@/lib/proofs";
import { siteUrl } from "@/lib/site";
import { requirePhotographer } from "@/lib/session";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { z } from "zod";
import { StatusPill } from "../status-pill";
import { ClientLink } from "./client-link";
import { PhotoGrid } from "./photo-grid";
import { ProofRefresher } from "./proof-refresher";
import { Uploader } from "./uploader";

export default async function GalleryPage({ params }: PageProps<"/dashboard/galleries/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      status: galleries.status,
      freeLimit: galleries.freeLimit,
      shareToken: galleries.shareToken,
      clientName: clients.name,
    })
    .from(galleries)
    .leftJoin(clients, eq(clients.id, galleries.clientId))
    .where(and(eq(galleries.id, id), eq(galleries.photographerId, user.id)));
  if (!gallery) notFound();

  const rows = await db
    .select({
      id: photos.id,
      fileKey: photos.fileKey,
      originalName: photos.originalName,
      width: photos.width,
      height: photos.height,
      favoriteId: favorites.id,
    })
    .from(photos)
    .leftJoin(favorites, eq(favorites.photoId, photos.id))
    .where(eq(photos.galleryId, gallery.id))
    .orderBy(asc(photos.position));

  const watermark = await getWatermarkSettings(user.id);
  const [{ staleCount }] = watermark
    ? await db
        .select({ staleCount: count() })
        .from(photos)
        .where(and(eq(photos.galleryId, gallery.id), staleProof(watermark.updatedAt)))
    : [{ staleCount: 0 }];
  const watermarkForBrowser = watermark
    ? { url: watermark.url, opacity: watermark.opacity, position: watermark.position }
    : null;

  const tiles = await Promise.all(
    rows.map(async (photo) => ({
      id: photo.id,
      name: photo.originalName,
      aspect: photo.width && photo.height ? photo.width / photo.height : 2 / 3,
      selected: photo.favoriteId !== null,
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
            <span className="text-sm font-semibold text-muted">
              {gallery.clientName ?? "No client"} · {gallery.freeLimit} free{" "}
              {gallery.freeLimit === 1 ? "pick" : "picks"}
            </span>
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

      <div className="mt-8 space-y-4">
        <ClientLink
          galleryId={gallery.id}
          url={`${siteUrl}/g/${gallery.shareToken}`}
          submitted={gallery.status === "submitted" || gallery.status === "paid_and_submitted"}
          selectedNames={tiles.filter((tile) => tile.selected).map((tile) => tile.name)}
          freeLimit={gallery.freeLimit}
        />
        {watermarkForBrowser && staleCount > 0 && (
          <ProofRefresher galleryId={gallery.id} watermark={watermarkForBrowser} staleCount={staleCount} />
        )}
        {!watermarkForBrowser && (
          <p className="rounded-2xl bg-sky-light/40 px-5 py-4 text-sm">
            <span className="font-semibold">No watermark yet.</span> Clients will see clean proofs.{" "}
            <Link href="/dashboard/settings" className="link">
              Add your watermark
            </Link>
          </p>
        )}
        <Uploader galleryId={gallery.id} watermark={watermarkForBrowser} />
      </div>

      {tiles.length > 0 && (
        <div className="mt-8">
          <PhotoGrid galleryId={gallery.id} photos={tiles} />
        </div>
      )}
    </>
  );
}
