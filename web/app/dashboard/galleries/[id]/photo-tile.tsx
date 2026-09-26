"use client";

import { useTransition } from "react";
import { HeartIcon } from "@/components/icons";
import { deletePhoto } from "../actions";

// One photo in the photographer's grid: uncropped in its own shape, a
// PhotoEZ-style number badge, a lime heart when the client picked it, the
// real file name underneath (as in PhotoEZ for WordPress, so picks are easy
// to find for editing), and a delete button on hover. Clicking opens the lightbox.
export function PhotoTile({
  galleryId,
  id,
  number,
  name,
  aspect,
  selected,
  note,
  thumbUrl,
  onOpen,
}: {
  galleryId: string;
  id: string;
  number: number;
  name: string;
  aspect: number;
  selected: boolean;
  note?: string | null;
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
        aria-label={`View ${name}`}
      >
        <span className="block overflow-hidden" style={{ aspectRatio: aspect }}>
        {/* Signed R2 URLs point at pre-sized thumbnails, so next/image optimization isn't needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt={name}
          loading="lazy"
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
        </span>
        {/* The real file name, e.g. IMG_4821.jpg; full name on hover when it's long. */}
        <span
          title={name}
          className={`block truncate px-2.5 py-1.5 text-left font-mono text-[11px] ${
            selected ? "bg-lime font-bold text-brand-deep" : "text-white/85"
          }`}
        >
          {name}
        </span>
      </button>
      {note && (
        <span
          className="pointer-events-none absolute top-11 left-2 rounded-full bg-sun px-2 py-0.5 text-[11px] font-bold text-brand-deep"
          title={note}
        >
          ✎ Note
        </span>
      )}
      <span className="pointer-events-none absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-brand-deep/80 text-xs font-bold text-white">
        {number}
      </span>
      {selected && (
        <span
          className="pointer-events-none absolute right-2 bottom-10 grid size-9 place-items-center rounded-full bg-lime text-brand-deep shadow-lg"
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
