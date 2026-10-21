"use client";

import Image from "next/image";
import { useState } from "react";

// A YouTube video that loads nothing from YouTube until it's played: a still
// image with a play button first, then the privacy-enhanced player
// (youtube-nocookie.com) on click. Keeps the "no tracking cookies" promise on
// the public pages (app/privacy) and keeps the page fast.
export function VideoFacade({
  videoId,
  title,
  poster,
}: {
  videoId: string;
  title: string;
  // A local still (in public/), 16:9.
  poster: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-brand-deep shadow-2xl ring-1 ring-black/5">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 size-full cursor-pointer"
          aria-label={`Play video: ${title}`}
        >
          <Image src={poster} alt="" fill sizes="(min-width: 1024px) 896px, 100vw" className="object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-brand-deep/50 via-transparent to-transparent" />
          {/* Bottom-left, so the play button never covers words in the poster
              (Elle's thumbnail has its headline in the middle). */}
          <span className="absolute bottom-4 left-4 flex items-center gap-3 sm:bottom-6 sm:left-6">
            <span className="grid size-14 place-items-center rounded-full bg-lime text-brand-deep shadow-xl transition group-hover:scale-110 sm:size-16">
              <svg viewBox="0 0 24 24" className="ml-0.5 size-7 sm:size-8" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
              </svg>
            </span>
            <span className="rounded-full bg-brand-deep/70 px-3 py-1.5 text-sm font-bold tracking-wider text-white uppercase backdrop-blur">
              Watch · 1 minute
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
