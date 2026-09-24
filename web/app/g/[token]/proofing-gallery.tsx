"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, HeartIcon } from "@/components/icons";
import { Lightbox } from "@/components/lightbox";
import { submitSelections, toggleFavorite } from "./actions";

export type Tile = { id: string; number: number; url: string; aspect: number; selected: boolean };

// The PhotoEZ proofing experience: numbered proofs, hearts to choose
// favorites up to the free limit, and a sticky bar to submit selections.
export function ProofingGallery({
  token,
  tiles,
  freeLimit,
  locked,
  preview,
  studio,
  clientFirstName,
}: {
  token: string;
  tiles: Tile[];
  freeLimit: number;
  locked: boolean;
  preview: boolean;
  studio: string;
  clientFirstName: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(tiles.filter((t) => t.selected).map((t) => t.id)));
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [onlySelected, setOnlySelected] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const canSelect = !locked && !preview;
  const limitText = freeLimit > 0 ? `${selected.size} of ${freeLimit}` : `${selected.size}`;
  const shown = onlySelected ? tiles.filter((tile) => selected.has(tile.id)) : tiles;

  async function toggle(photoId: string) {
    if (preview) {
      setMessage("This is a preview. Your client picks photos from their own link.");
      return;
    }
    if (!canSelect) return;
    setMessage(null);
    const wasSelected = selected.has(photoId);
    if (!wasSelected && freeLimit > 0 && selected.size >= freeLimit) {
      setMessage(`You can choose up to ${freeLimit} photos. Unselect one to pick another.`);
      return;
    }
    // Update right away, then confirm with the server (and undo if it says no).
    const flip = (on: boolean) =>
      setSelected((current) => {
        const next = new Set(current);
        if (on) next.add(photoId);
        else next.delete(photoId);
        return next;
      });
    flip(!wasSelected);
    const result = await toggleFavorite(token, photoId);
    if ("error" in result) {
      flip(wasSelected);
      setMessage(result.error);
    }
  }

  function submit() {
    const noun = selected.size === 1 ? "photo" : "photos";
    if (!confirm(`Submit your ${selected.size} ${noun}? You won't be able to change your picks after this.`)) return;
    startSubmit(async () => {
      const result = await submitSelections(token);
      if ("error" in result) setMessage(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-bold">
            {locked ? "Your selections are in!" : `Hello${clientFirstName ? `, ${clientFirstName}` : ""}!`}
          </p>
          <p className="mt-1 text-muted">
            {locked
              ? `${studio} is editing the photos you chose. You'll get your final photos here.`
              : "Tap the heart on your favorite photos, then submit your selections."}
          </p>
        </div>
        {/* PhotoEZ-style round counter */}
        <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-full bg-brand text-white ring-4 ring-lime/50">
          <span className="font-display text-2xl leading-none font-bold">
            {freeLimit > 0 ? `${selected.size}/${freeLimit}` : selected.size}
          </span>
          <span className="mt-1 text-[10px] font-bold tracking-wider uppercase">Selected</span>
        </div>
      </div>

      {!locked && (
        <p className="mt-6 rounded-2xl bg-sky-light/50 px-5 py-3 text-sm">
          {freeLimit > 0 ? (
            <>
              Choose up to <strong>{freeLimit} photos</strong> from your session of <strong>{tiles.length} images</strong>.
            </>
          ) : (
            <>
              Choose your favorites from your session of <strong>{tiles.length} images</strong>.
            </>
          )}
        </p>
      )}

      {selected.size > 0 && (
        <div className="mt-6 flex gap-2">
          {[false, true].map((only) => (
            <button
              key={String(only)}
              type="button"
              onClick={() => setOnlySelected(only)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase transition ${
                onlySelected === only ? "bg-brand text-white" : "bg-surface text-muted ring-1 ring-border hover:text-foreground"
              }`}
            >
              {only ? `My picks (${selected.size})` : `All photos (${tiles.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Masonry, like the PhotoEZ proofing gallery: columns keep every photo
          uncropped in its own shape. Numbers read down each column. */}
      <ul className="mt-6 columns-2 gap-3 pb-28 sm:columns-3 lg:columns-4 xl:columns-5">
        {shown.map((tile) => {
          const isSelected = selected.has(tile.id);
          return (
            <li key={tile.id} className="mb-3 break-inside-avoid">
              <div
                className={`group relative overflow-hidden rounded-2xl bg-brand-deep transition ${
                  isSelected ? "ring-4 ring-lime" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(tiles.indexOf(tile))}
                  className="block w-full"
                  style={{ aspectRatio: tile.aspect }}
                  aria-label={`View photo ${tile.number}`}
                >
                  {/* Signed links to watermarked proofs; next/image optimization isn't needed. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.url}
                    alt={`Photo ${tile.number}`}
                    loading="lazy"
                    draggable={false}
                    onContextMenu={(event) => event.preventDefault()}
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </button>
                <span className="pointer-events-none absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-brand-deep/80 text-xs font-bold text-white">
                  {tile.number}
                </span>
                {(canSelect || preview || isSelected) && (
                  <button
                    type="button"
                    onClick={() => toggle(tile.id)}
                    disabled={locked}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? `Unselect photo ${tile.number}` : `Select photo ${tile.number}`}
                    className={`absolute right-2 bottom-2 grid size-11 place-items-center rounded-full shadow-lg transition ${
                      isSelected ? "bg-lime text-brand-deep" : "bg-white/90 text-brand-deep hover:scale-110"
                    }`}
                  >
                    <HeartIcon size={22} fill={isSelected ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sticky PhotoEZ selection bar */}
      {!locked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="font-semibold">{limitText} photos selected</span>
              {message && <span className="mt-0.5 block font-medium text-danger">{message}</span>}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={preview || selected.size === 0 || submitting}
              className="btn-primary"
            >
              {submitting ? "Submitting…" : "Submit my selections"} <ArrowRightIcon size={18} />
            </button>
          </div>
        </div>
      )}

      {open !== null && (
        <Lightbox
          items={tiles}
          index={open}
          onIndex={(index) => {
            setMessage(null);
            setOpen(index);
          }}
          onClose={() => {
            setMessage(null);
            setOpen(null);
          }}
          selected={selected}
          onToggle={canSelect ? toggle : undefined}
          badge="One of your picks"
          status={canSelect ? `${limitText} selected` : undefined}
          notice={message}
        />
      )}
    </>
  );
}
