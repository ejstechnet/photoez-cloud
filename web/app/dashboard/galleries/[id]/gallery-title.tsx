"use client";

import { useState, useTransition } from "react";
import { inputClass } from "@/components/form";
import { renameGallery } from "../actions";

// The gallery's name, with a Rename button that edits it in place.
export function GalleryTitle({ galleryId, title }: { galleryId: string; title: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await renameGallery(galleryId, value);
      if ("error" in result) setError(result.error);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-4xl font-bold tracking-tight break-words sm:text-5xl">{title}</h1>
        <button
          type="button"
          onClick={() => {
            setValue(title);
            setEditing(true);
          }}
          className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          ✎ Rename
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        aria-label="Gallery name"
        maxLength={200}
        className={`${inputClass} max-w-xl font-display text-2xl font-bold`}
      />
      <button type="submit" disabled={pending} className="btn-primary px-5 py-2">
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
      >
        Cancel
      </button>
      {error && <p className="w-full text-sm font-medium text-danger">{error}</p>}
    </form>
  );
}
