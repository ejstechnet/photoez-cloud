"use client";

import { useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { Lightbox } from "@/components/lightbox";

export type FinalTile = {
  id: string;
  number: number;
  name: string;
  aspect: number;
  thumbUrl: string;
  previewUrl: string;
  downloadUrl: string;
};

// The PhotoEZ "Final delivery" page: clean, unwatermarked finals in the
// masonry grid, a download on every photo, and one ZIP for everything.
export function DeliveryGallery({
  token,
  preview = false,
  tiles,
  studio,
  clientFirstName,
  totalSize,
}: {
  token: string;
  // The photographer's "Preview as client": downloads work but aren't recorded.
  preview?: boolean;
  tiles: FinalTile[];
  studio: string;
  clientFirstName: string | null;
  totalSize: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-bold">
            Your final photos are ready{clientFirstName ? `, ${clientFirstName}` : ""}!
          </p>
          <p className="mt-1 text-muted">
            {tiles.length} {tiles.length === 1 ? "photo" : "photos"} from {studio}, full resolution and ready to keep.
          </p>
        </div>
        <a href={`/g/${token}/download${preview ? "?preview=1" : ""}`} className="btn-primary">
          <DownloadIcon size={18} /> Download all · {totalSize}
        </a>
      </div>

      <ul className="mt-8 columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
        {tiles.map((tile, i) => (
          <li key={tile.id} className="mb-3 break-inside-avoid">
            <div className="group relative overflow-hidden rounded-2xl bg-brand-deep">
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="block w-full"
                style={{ aspectRatio: tile.aspect }}
                aria-label={`View photo ${tile.number}`}
              >
                {/* Signed links to pre-sized versions; next/image optimization isn't needed. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.thumbUrl}
                  alt={`Photo ${tile.number}`}
                  loading="lazy"
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
              </button>
              <span className="pointer-events-none absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-brand-deep/80 text-xs font-bold text-white">
                {tile.number}
              </span>
              <a
                href={tile.downloadUrl}
                aria-label={`Download photo ${tile.number}`}
                className="absolute right-2 bottom-2 grid size-11 place-items-center rounded-full bg-white/90 text-brand-deep shadow-lg transition hover:scale-110 hover:bg-lime"
              >
                <DownloadIcon size={20} />
              </a>
            </div>
          </li>
        ))}
      </ul>

      {open !== null && (
        <Lightbox
          items={tiles.map((tile) => ({
            id: tile.id,
            number: tile.number,
            url: tile.previewUrl,
            downloadUrl: tile.downloadUrl,
          }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
