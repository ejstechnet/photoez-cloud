"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CULL_FLAGS, CULL_LABELS, cullGallery, type CullFlag, type CullMetrics } from "@/lib/culling";
import { measurePhoto } from "@/lib/culling-browser";
import { deletePhoto, saveCullResults } from "../actions";
import { PhotoGrid, type GridPhoto } from "./photo-grid";

type CullPhoto = GridPhoto & { cull: CullMetrics | null };

const FLAG_STYLES: Record<CullFlag, string> = {
  blurry: "bg-coral text-white",
  dark: "bg-brand-deep text-white",
  bright: "bg-sun text-brand-deep",
  eyes: "bg-violet text-white",
  duplicate: "bg-sky text-white",
};

// The proofs grid with culling help on top: check photos in the browser,
// see which look blurry, too dark or bright, have closed eyes, or are
// near-duplicates, and clear them out before the client sees them.
export function CullingGrid({ galleryId, photos }: { galleryId: string; photos: CullPhoto[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<CullFlag | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const result = useMemo(() => cullGallery(photos), [photos]);
  const counts = Object.fromEntries(
    CULL_FLAGS.map((flag) => [flag, photos.filter((p) => result.flags.get(p.id)?.includes(flag)).length]),
  ) as Record<CullFlag, number>;
  const anyFlags = CULL_FLAGS.some((flag) => counts[flag] > 0);

  const numbered = photos.map((photo, i) => ({ ...photo, number: i + 1, flags: result.flags.get(photo.id) ?? [] }));
  const shown = filter ? numbered.filter((p) => p.flags.includes(filter)) : numbered;

  async function check() {
    setError(null);
    const todo = photos.filter((p) => !p.cull);
    let done = 0;
    let batch: { photoId: string; cull: CullMetrics }[] = [];
    try {
      for (const photo of todo) {
        setProgress(`Checking ${done + 1} of ${todo.length}…`);
        try {
          batch.push({ photoId: photo.id, cull: await measurePhoto(photo.previewUrl) });
        } catch {
          // One unreadable photo shouldn't stop the rest.
        }
        done++;
        if (batch.length >= 10) {
          await saveCullResults(galleryId, batch);
          batch = [];
        }
      }
      if (batch.length) await saveCullResults(galleryId, batch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checking stopped. Try again.");
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  // What the cleanup button would delete: never the client's picks, and for
  // near-duplicates, everything except the sharpest of each set.
  const toDelete = (() => {
    if (!filter) return [];
    const picked = new Set(photos.filter((p) => p.selected).map((p) => p.id));
    const ids =
      filter === "duplicate"
        ? result.duplicateSets.flatMap((set) => set.slice(1))
        : shown.map((p) => p.id);
    return ids.filter((id) => !picked.has(id));
  })();

  function cleanUp() {
    const what =
      filter === "duplicate"
        ? `Keep the sharpest photo of each near-duplicate set and delete the other ${toDelete.length}?`
        : `Delete these ${toDelete.length} photos marked "${CULL_LABELS[filter!]}"?`;
    if (!confirm(`${what} This can't be undone. Photos your client picked are never deleted here.`)) return;
    startDelete(async () => {
      for (const id of toDelete) await deletePhoto(galleryId, id);
      setFilter(null);
      router.refresh();
    });
  }

  const chip = (active: boolean) =>
    `rounded-full border-2 px-3.5 py-1.5 text-xs font-bold tracking-wider uppercase transition ${
      active ? "border-brand bg-brand text-white" : "border-border hover:border-muted"
    }`;

  return (
    <>
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold">✨ Culling help</p>
            <p className="text-sm text-muted">
              {result.checked === 0
                ? "Find blurry, too dark or bright, closed-eye, and near-duplicate photos before your client sees them."
                : anyFlags
                  ? "Tap a label to see those photos. Nothing is deleted unless you choose to."
                  : "Nothing stood out. These look good to go!"}
            </p>
          </div>
          {result.unchecked > 0 && (
            <button type="button" onClick={check} disabled={progress !== null} className="btn-primary px-5 py-2.5">
              {progress ?? `Check ${result.unchecked} ${result.unchecked === 1 ? "photo" : "photos"}`}
            </button>
          )}
        </div>
        {result.checked > 0 && anyFlags && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFilter(null)} className={chip(filter === null)}>
              All photos ({photos.length})
            </button>
            {CULL_FLAGS.filter((flag) => counts[flag] > 0).map((flag) => (
              <button key={flag} type="button" onClick={() => setFilter(filter === flag ? null : flag)} className={chip(filter === flag)}>
                {CULL_LABELS[flag]}{" "}
                {flag === "duplicate" ? `(${result.duplicateSets.length} ${result.duplicateSets.length === 1 ? "set" : "sets"})` : `(${counts[flag]})`}
              </button>
            ))}
            {filter && toDelete.length > 0 && (
              <button
                type="button"
                onClick={cleanUp}
                disabled={deleting}
                className="ml-auto rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wider text-danger uppercase hover:bg-danger/10"
              >
                {deleting
                  ? "Deleting…"
                  : filter === "duplicate"
                    ? `Keep the best, delete ${toDelete.length}`
                    : `Delete these ${toDelete.length}`}
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          Checked in your browser, so it&apos;s free and your photos stay private. These are suggestions; trust your eye.
        </p>
      </div>

      <PhotoGrid
        galleryId={galleryId}
        photos={shown}
        badges={(photo) =>
          (photo as (typeof numbered)[number]).flags.map((flag) => (
            <span key={flag} className={`rounded-full px-2 py-0.5 text-[10px] font-bold shadow ${FLAG_STYLES[flag]}`}>
              {CULL_LABELS[flag]}
            </span>
          ))
        }
      />
    </>
  );
}
