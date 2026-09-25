import Link from "next/link";
import { asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clients, galleries, photos } from "@/db/schema";
import { ArrowRightIcon, ImagesIcon, PlusIcon } from "@/components/icons";
import { requirePhotographer } from "@/lib/session";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { StatusPill } from "./status-pill";
import { downloadSummaries } from "@/lib/downloads";

const coverTints = ["from-coral to-sun", "from-violet to-pink", "from-lime to-sun", "from-pink to-coral"];

export default async function GalleriesPage() {
  const user = await requirePhotographer();

  const rows = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      status: galleries.status,
      clientName: clients.name,
      photoCount: count(photos.id),
    })
    .from(galleries)
    .leftJoin(clients, eq(clients.id, galleries.clientId))
    .leftJoin(photos, eq(photos.galleryId, galleries.id))
    .where(eq(galleries.photographerId, user.id))
    .groupBy(galleries.id, clients.name)
    .orderBy(desc(galleries.createdAt));
  const downloads = await downloadSummaries(rows.map((g) => g.id));

  // Cover photo = the first proof in each gallery (or the first final).
  const covers =
    rows.length === 0
      ? []
      : await db
          .selectDistinctOn([photos.galleryId], { galleryId: photos.galleryId, fileKey: photos.fileKey })
          .from(photos)
          .where(
            inArray(
              photos.galleryId,
              rows.map((row) => row.id),
            ),
          )
          // "proof" sorts after "final", so desc puts proofs first; finals are the fallback.
          .orderBy(photos.galleryId, desc(photos.kind), asc(photos.position));
  const coverUrls = new Map(
    await Promise.all(
      covers.map(async (cover) => [cover.galleryId, await signedViewUrl(photoKey(cover.fileKey, "thumb"))] as const),
    ),
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-wider text-violet uppercase">
            {rows.length === 1 ? "1 gallery" : `${rows.length} galleries`}
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Galleries</h1>
        </div>
        <Link href="/dashboard/galleries/new" className="btn-primary">
          <PlusIcon size={18} /> New gallery
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-10 flex flex-col items-center border-2 border-dashed px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-violet text-brand-deep">
            <ImagesIcon size={28} />
          </span>
          <p className="mt-5 font-display text-2xl font-bold">Create your first gallery</p>
          <p className="mt-2 max-w-sm text-muted">A gallery holds one session&apos;s photos, ready to share with your client.</p>
          <Link href="/dashboard/galleries/new" className="btn-primary mt-6">
            New gallery <ArrowRightIcon size={18} />
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {rows.map((gallery, i) => {
            const cover = coverUrls.get(gallery.id);
            return (
              <li key={gallery.id}>
                <Link
                  href={`/dashboard/galleries/${gallery.id}`}
                  className="card group block overflow-hidden transition hover:-translate-y-1 hover:shadow-xl"
                >
                  {/* 2:3 portrait covers (a 4×6 print), since most sessions are shot in portrait. */}
                  <div className="relative aspect-[2/3] bg-brand-deep">
                    {cover ? (
                      // Signed R2 URLs are already sized thumbnails, so next/image optimization isn't needed.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="size-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div
                        className={`grid size-full place-items-center bg-gradient-to-br text-brand-deep ${coverTints[i % coverTints.length]}`}
                      >
                        <ImagesIcon size={36} />
                      </div>
                    )}
                    <span className="absolute top-3 left-3">
                      <StatusPill status={gallery.status} />
                    </span>
                  </div>
                  <div className="p-4 sm:p-5">
                    <p className="truncate font-display text-lg font-bold sm:text-xl">{gallery.title}</p>
                    <p className="mt-1 truncate text-sm text-muted">
                      {gallery.clientName ?? "No client"} · {gallery.photoCount}{" "}
                      {gallery.photoCount === 1 ? "photo" : "photos"}
                    </p>
                    {gallery.status === "delivered" && (
                      <p
                        className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase ${
                          downloads.has(gallery.id) ? "bg-lime/25 text-lime-ink" : "bg-sun/30 text-brand-deep"
                        }`}
                      >
                        {downloads.has(gallery.id) ? "✓ Downloaded" : "Not downloaded yet"}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
