"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { makeGallerySearchable, searchOwnGallery } from "../actions";

// Gallery search on the dashboard: describe the photos with AI (once), then
// try a search the way the client will.
export function SearchCard({
  galleryId,
  total,
  searchable,
  allowance,
  upgradeLabel,
  photos,
}: {
  galleryId: string;
  total: number;
  searchable: number;
  allowance: { enabled: boolean; left: number; limit: number };
  upgradeLabel: string;
  photos: { id: string; name: string; thumbUrl: string }[];
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<string[] | null>(null);
  const [searching, startSearch] = useTransition();
  const waiting = total - searchable;

  async function describe() {
    setError(null);
    let done = searchable;
    try {
      for (;;) {
        setProgress(`Describing photos… ${done} of ${total}`);
        const result = await makeGallerySearchable(galleryId);
        if ("error" in result) {
          setError(result.error);
          break;
        }
        done = total - result.remaining;
        if (result.remaining === 0 || result.tagged === 0) break;
      }
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  function search(event: React.FormEvent) {
    event.preventDefault();
    startSearch(async () => setMatches(query.trim() ? await searchOwnGallery(galleryId, query) : null));
  }

  const found = matches ? photos.filter((p) => matches.includes(p.id)) : [];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold">🔎 Gallery search</p>
          <p className="text-sm text-muted">
            {!allowance.enabled
              ? `Let clients search their photos by typing things like "first dance" or "with grandma". Available on the ${upgradeLabel} plan and up.`
              : searchable === 0
                ? 'AI describes each photo once, so you and your client can search by typing things like "first dance" or "with grandma".'
                : `${searchable} of ${total} photos are searchable. Your client sees a search box in their gallery.`}
          </p>
        </div>
        {allowance.enabled && waiting > 0 && (
          <button
            type="button"
            onClick={describe}
            disabled={progress !== null || allowance.left === 0}
            className="btn-primary px-5 py-2.5"
          >
            {progress ?? `Make ${waiting} ${waiting === 1 ? "photo" : "photos"} searchable`}
          </button>
        )}
      </div>

      {allowance.enabled && searchable > 0 && (
        <form onSubmit={search} className="mt-4 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try a search, like "smiling" or "outdoors"'
            aria-label="Search this gallery"
            className="block w-full rounded-full border-2 border-border bg-surface px-4 py-2 text-sm outline-none focus:border-lime-ink"
          />
          <button type="submit" disabled={searching} className="btn-secondary shrink-0">
            {searching ? "…" : "Search"}
          </button>
        </form>
      )}
      {matches && (
        <div className="mt-3">
          <p className="text-sm font-semibold">
            {found.length === 0 ? "No photos matched." : `${found.length} ${found.length === 1 ? "photo" : "photos"} matched:`}
          </p>
          {found.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {found.slice(0, 30).map((p) => (
                <li key={p.id} className="overflow-hidden rounded-xl bg-brand-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={p.name} className="aspect-[4/5] w-full object-cover" />
                  {/* The real file name, for finding it in Lightroom. */}
                  <p title={p.name} className="truncate px-2.5 py-1.5 font-mono text-[11px] text-white/85">
                    {p.name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      {allowance.enabled && (
        <p className="mt-3 text-xs text-muted">
          {allowance.left.toLocaleString()} of {allowance.limit.toLocaleString()} photo descriptions left this month.
        </p>
      )}
    </div>
  );
}
