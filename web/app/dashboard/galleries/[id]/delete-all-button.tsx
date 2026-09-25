"use client";

import { useTransition } from "react";
import { deleteAllPhotos } from "../actions";

// "Delete all" for a gallery's proofs or finals, as in PhotoEZ for WordPress.
export function DeleteAllButton({
  galleryId,
  kind,
  count,
}: {
  galleryId: string;
  kind: "proof" | "final";
  count: number;
}) {
  const [pending, startTransition] = useTransition();
  const noun = kind === "proof" ? (count === 1 ? "proof" : "proofs") : count === 1 ? "final photo" : "final photos";
  const warning =
    kind === "proof"
      ? "Your client's hearts on them go too."
      : "If this gallery was delivered, your client won't be able to download them anymore.";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete all ${count} ${noun}? ${warning} This can't be undone.`)) {
          startTransition(() => deleteAllPhotos(galleryId, kind));
        }
      }}
      className="rounded-full border-2 border-danger/40 px-4 py-1.5 text-xs font-bold tracking-wider text-danger uppercase transition hover:bg-danger/10 disabled:opacity-60"
    >
      {pending ? "Deleting…" : `Delete all ${kind === "proof" ? "proofs" : "finals"}`}
    </button>
  );
}
