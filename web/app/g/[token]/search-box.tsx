"use client";

import { useState, useTransition } from "react";
import { SearchIcon } from "@/components/icons";
import { searchGallery } from "./actions";

// The client's gallery search: type "first dance" or "with grandma" and the
// grid narrows to the matching photos (described by AI when the photographer
// made the gallery searchable).
export function SearchBox({ token, onResults }: { token: string; onResults: (ids: string[] | null) => void }) {
  const [query, setQuery] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function run(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return clear();
    startTransition(async () => {
      const ids = await searchGallery(token, q);
      setCount(ids.length);
      onResults(ids);
    });
  }

  function clear() {
    setQuery("");
    setCount(null);
    onResults(null);
  }

  return (
    <form onSubmit={run} className="flex flex-wrap items-center gap-2" role="search">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search your photos, like "laughing" or "outdoors"'
          aria-label="Search your photos"
          className="block w-full rounded-full border-2 border-border bg-surface py-2 pr-4 pl-10 text-sm outline-none focus:border-lime-ink"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-secondary px-4 py-2 text-xs">
        {pending ? "Searching…" : "Search"}
      </button>
      {count !== null && (
        <span className="text-sm text-muted">
          {count === 0 ? "No matches." : `${count} ${count === 1 ? "photo" : "photos"} found.`}{" "}
          <button type="button" onClick={clear} className="font-semibold text-link hover:underline">
            Show all
          </button>
        </span>
      )}
    </form>
  );
}
