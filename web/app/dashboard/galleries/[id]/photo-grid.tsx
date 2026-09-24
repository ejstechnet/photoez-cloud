"use client";

import { useState } from "react";
import { Lightbox } from "@/components/lightbox";
import { PhotoTile } from "./photo-tile";

export type GridPhoto = {
  id: string;
  name: string;
  aspect: number;
  selected: boolean;
  thumbUrl: string;
  previewUrl: string;
};

// The photographer's masonry grid (same layout as the client's) with the
// shared lightbox. Here the lightbox shows the clean preview, the file name,
// and marks the client's picks.
export function PhotoGrid({ galleryId, photos }: { galleryId: string; photos: GridPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5">
        {photos.map((photo, i) => (
          <li key={photo.id} className="mb-3 break-inside-avoid">
            <PhotoTile galleryId={galleryId} number={i + 1} onOpen={() => setOpen(i)} {...photo} />
          </li>
        ))}
      </ul>
      {open !== null && (
        <Lightbox
          items={photos.map((photo, i) => ({ id: photo.id, number: i + 1, url: photo.previewUrl, caption: photo.name }))}
          index={Math.min(open, photos.length - 1)}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          selected={new Set(photos.filter((photo) => photo.selected).map((photo) => photo.id))}
          badge="Client's pick"
        />
      )}
    </>
  );
}
