"use client";

import { useTransition } from "react";
import { deleteGallery } from "../../actions";

export function DeleteGalleryButton({ galleryId, title }: { galleryId: string; title: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Delete "${title}" and all of its photos? This can't be undone.`)) return;
    startTransition(() => deleteGallery(galleryId));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-full border-2 border-danger/40 px-5 py-2 text-xs font-bold tracking-wider text-danger uppercase transition hover:bg-danger/10 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete gallery"}
    </button>
  );
}
