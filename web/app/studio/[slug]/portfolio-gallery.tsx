"use client";

import { useState } from "react";
import { Lightbox } from "@/components/lightbox";

// "Examples of work" on the studio page: the photographer's portfolio photos
// in a tidy grid; click one to see it large (the same viewer as galleries).
export function PortfolioGallery({ studioName, photos }: { studioName: string; photos: { id: string; url: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const items = photos.map((photo, i) => ({ id: photo.id, number: i + 1, url: photo.url }));

  return (
    <section id="work" className="mx-auto w-full max-w-7xl scroll-mt-28 px-4 pb-16">
      <h2 className="font-display text-3xl font-bold">Examples of my work</h2>
      <div
        className={`mt-4 grid gap-2 sm:gap-3 ${
          photos.length <= 3 ? "grid-cols-2 sm:grid-cols-3" : photos.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        }`}
      >
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-border"
            aria-label={`View photo ${i + 1} of ${photos.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`${studioName} photography example ${i + 1}`}
              loading="lazy"
              className="size-full object-cover transition duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}
