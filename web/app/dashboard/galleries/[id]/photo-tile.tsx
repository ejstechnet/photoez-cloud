"use client";

import { useTransition } from "react";
import { HeartIcon } from "@/components/icons";
import { deletePhoto } from "../actions";

// One photo in the photographer's grid: uncropped in its own shape, a
// PhotoEZ-style number badge, a lime heart when the client picked it, and a
// delete button on hover. Clicking opens the lightbox.
export function PhotoTile({
  galleryId,
  id,
  number,
  name,
  aspect,
  selected,
  thumbUrl,
  onOpen,
}: {
  galleryId: string;
  id: string;
  number: number;
  name: string;
  aspect: number;
  selected: boolean;
  thumbUrl: string;
  onOpen: () => void;
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
    <div
      className={`group relative overflow-hidden rounded-2xl bg-brand-deep ${selected ? "ring-4 ring-lime" : ""} ${
        pending ? "opacity-40" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full"
        style={{ aspectRatio: aspect }}
        aria-label={`View ${name}`}
      >
        {/* Signed R2 URLs point at pre-sized thumbnails, so next/image optimization isn't needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt={name}
          loading="lazy"
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
      </button>
      <span className="pointer-events-none absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-brand-deep/80 text-xs font-bold text-white">
        {number}
      </span>
      {selected && (
        <span
          className="pointer-events-none absolute right-2 bottom-2 grid size-9 place-items-center rounded-full bg-lime text-brand-deep shadow-lg"
          title="The client picked this photo"
        >
          <HeartIcon size={18} fill="currentColor" />
        </span>
      )}
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
