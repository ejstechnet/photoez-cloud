"use client";

import { useEffect } from "react";
import { ArrowRightIcon, HeartIcon } from "./icons";

export type LightboxItem = { id: string; number: number; url: string; caption?: string };

// Full-screen photo viewer, styled after the PhotoEZ for WordPress lightbox:
// dark backdrop, the photo centered with arrows beside it, a "6 / 14" counter,
// and (when proofing) a select pill that turns lime once the photo is picked.
// Keyboard: ← → to move, Esc to close.
export function Lightbox({
  items,
  index,
  onIndex,
  onClose,
  selected,
  onToggle,
  badge,
  status,
  notice,
}: {
  items: LightboxItem[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  // Proofing only: which photos are picked, and how to pick one.
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  // Read-only label for picked photos, e.g. "Client's pick" in the dashboard.
  badge?: string;
  // Running tally shown under the photo, e.g. "10 of 10 selected".
  status?: string;
  // A message for the viewer, e.g. why a photo couldn't be selected. Shown
  // here because the page behind the lightbox is covered.
  notice?: string | null;
}) {
  const item = items[index];
  const go = (step: number) => onIndex((index + step + items.length) % items.length);
  const isSelected = selected?.has(item.id) ?? false;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, items.length, onIndex, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${item.number} of ${items.length}`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 px-4 py-6 text-white"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 grid size-11 place-items-center rounded-full text-2xl leading-none ring-1 ring-white/30 hover:ring-lime"
      >
        ×
      </button>

      <div className="relative flex min-h-0 items-center">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous photo"
          className="absolute -left-2 z-10 grid size-11 rotate-180 place-items-center rounded-full bg-black/40 hover:text-lime sm:-left-16 sm:bg-transparent"
        >
          <ArrowRightIcon size={28} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={item.id}
          src={item.url}
          alt={`Photo ${item.number}`}
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          className={`max-h-[72vh] max-w-[90vw] rounded-lg object-contain ${isSelected ? "ring-4 ring-lime" : ""}`}
        />
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next photo"
          className="absolute -right-2 z-10 grid size-11 place-items-center rounded-full bg-black/40 hover:text-lime sm:-right-16 sm:bg-transparent"
        >
          <ArrowRightIcon size={28} />
        </button>
      </div>

      <div className="mt-5 flex flex-col items-center gap-3">
        {onToggle ? (
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            aria-pressed={isSelected}
            className={`inline-flex items-center gap-2.5 rounded-full border-2 px-7 py-3 font-semibold transition ${
              isSelected ? "border-white bg-lime text-brand-deep" : "border-white bg-black/60 hover:border-lime"
            }`}
          >
            <HeartIcon size={20} fill={isSelected ? "currentColor" : "none"} className={isSelected ? "" : "opacity-60"} />
            {isSelected ? "Selected" : "Select this photo"}
          </button>
        ) : (
          isSelected &&
          badge && (
            <span className="inline-flex items-center gap-2 text-sm font-bold tracking-wider text-lime uppercase">
              <HeartIcon size={18} fill="currentColor" /> {badge}
            </span>
          )
        )}
        {notice && (
          <p role="alert" className="max-w-sm rounded-xl bg-sun px-4 py-2 text-center text-sm font-semibold text-brand-deep">
            {notice}
          </p>
        )}
        <p className="text-sm text-white/60">
          {item.number} / {items.length}
          {status && <span className="ml-2 font-semibold text-lime">· {status}</span>}
          {item.caption && <span className="ml-2 text-white/40">· {item.caption}</span>}
        </p>
      </div>
    </div>
  );
}
