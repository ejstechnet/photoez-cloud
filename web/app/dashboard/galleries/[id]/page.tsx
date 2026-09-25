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
import { DeliverPanel } from "./deliver-panel";
import { GalleryTitle } from "./gallery-title";
import { describeDownloads, downloadSummaries } from "@/lib/downloads";
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
      deliveredAt: galleries.deliveredAt,
      clientName: clients.name,
    })
    .from(galleries)
    .leftJoin(clients, eq(clients.id, galleries.clientId))
    .where(and(eq(galleries.id, id), eq(galleries.photographerId, user.id)));
  if (!gallery) notFound();

  const rows = await db
    .select({
      id: photos.id,
      kind: photos.kind,
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
        .where(and(eq(photos.galleryId, gallery.id), eq(photos.kind, "proof"), staleProof(watermark.updatedAt)))
    : [{ staleCount: 0 }];
  const watermarkForBrowser = watermark
    ? { url: watermark.url, opacity: watermark.opacity, position: watermark.position }
    : null;

  const tiles = await Promise.all(
    rows.map(async (photo) => ({
      id: photo.id,
      kind: photo.kind,
      name: photo.originalName,
      aspect: photo.width && photo.height ? photo.width / photo.height : 2 / 3,
      selected: photo.favoriteId !== null,
      thumbUrl: await signedViewUrl(photoKey(photo.fileKey, "thumb")),
      previewUrl: await signedViewUrl(photoKey(photo.fileKey, "preview")),
    })),
  );
  const downloads = await downloadSummaries([gallery.id]);
  const proofs = tiles.filter((tile) => tile.kind === "proof");
  const finals = tiles.filter((tile) => tile.kind === "final");

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
          <GalleryTitle galleryId={gallery.id} title={gallery.title} />
        </div>
        <div className="flex items-center gap-4">
          {/* PhotoEZ-style round counters */}
          <Counter value={proofs.length} label="proofs" ring="ring-sky/40" />
          <Counter value={finals.length} label="finals" ring="ring-lime/50" />
          <Link href={`/dashboard/galleries/${gallery.id}/edit`} className="btn-secondary">
            Settings
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <ClientLink
          galleryId={gallery.id}
          url={`${siteUrl}/g/${gallery.shareToken}`}
          submitted={gallery.status === "submitted" || gallery.status === "paid_and_submitted"}
          selectedNames={proofs.filter((tile) => tile.selected).map((tile) => tile.name)}
          freeLimit={gallery.freeLimit}
        />
      </div>

      {/* Step 1: proofs the client chooses from (watermarked for them). */}
      <section className="mt-12">
        <SectionHeading step={1} title="Proofs" note="Your client picks favorites from these." />
        <div className="mt-5 space-y-4">
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
          <Uploader galleryId={gallery.id} kind="proof" watermark={watermarkForBrowser} />
          {proofs.length > 0 && <PhotoGrid galleryId={gallery.id} photos={proofs} />}
        </div>
      </section>

      {/* Step 2: the edited finals, delivered clean and full resolution. */}
      <section className="mt-14">
        <SectionHeading step={2} title="Finals" note="Edited photos your client downloads, never watermarked." />
        <div className="mt-5 space-y-4">
          <DeliverPanel
            galleryId={gallery.id}
            finalsCount={finals.length}
            deliveredAt={gallery.deliveredAt?.toISOString() ?? null}
            downloads={{ text: describeDownloads(downloads.get(gallery.id)), any: downloads.has(gallery.id) }}
          />
          <Uploader galleryId={gallery.id} kind="final" watermark={null} />
          {finals.length > 0 && <PhotoGrid galleryId={gallery.id} photos={finals} />}
        </div>
      </section>
    </>
  );
}

function Counter({ value, label, ring }: { value: number; label: string; ring: string }) {
  return (
    <div className={`flex size-16 flex-col items-center justify-center rounded-full bg-brand text-white ring-4 ${ring}`}>
      <span className="font-display text-xl leading-none font-bold">{value}</span>
      <span className="mt-0.5 text-[9px] font-bold tracking-wider uppercase">{label}</span>
    </div>
  );
}

function SectionHeading({ step, title, note }: { step: number; title: string; note: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-3">
      <span className="grid size-8 place-items-center rounded-full bg-lime font-bold text-brand-deep">{step}</span>
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="text-sm text-muted">{note}</p>
      </div>
    </div>
  );
}
