"use client";

import { useTransition } from "react";
import { deletePhoto } from "../actions";

// One photo in the gallery grid: PhotoEZ-style number badge, opens the
// preview on click, and a delete button on hover.
export function PhotoTile({
  galleryId,
  id,
  number,
  name,
  thumbUrl,
  previewUrl,
}: {
  galleryId: string;
  id: string;
  number: number;
  name: string;
  thumbUrl: string;
  previewUrl: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete ${name}? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deletePhoto(galleryId, id);
      if ("error" in result) alert(result.error);
    });
  }

  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-brand-deep ${pending ? "opacity-40" : ""}`}>
      {/* 2:3 portrait tiles (a 4×6 print), since most sessions are shot in portrait. */}
      <a href={previewUrl} target="_blank" rel="noreferrer" className="block aspect-[2/3]">
        {/* Signed R2 URLs point at pre-sized thumbnails, so next/image optimization isn't needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt={name}
          loading="lazy"
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
      </a>
      <span className="pointer-events-none absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-brand-deep/80 text-xs font-bold text-white">
        {number}
      </span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        aria-label={`Delete ${name}`}
        className="absolute top-2 right-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold tracking-wider text-danger uppercase opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        Delete
      </button>
    </div>
  );
}
