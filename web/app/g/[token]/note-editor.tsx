"use client";

import { useState, useTransition } from "react";
import { saveNote } from "./actions";

export const MAX_NOTE = 500;

// A client's note on one of their picks (e.g. "please soften the shadows"),
// shown under the photo in the lightbox. Saves on the button or when the box
// loses focus with changes.
export function NoteEditor({
  token,
  photoId,
  note,
  onSaved,
}: {
  token: string;
  photoId: string;
  note: string;
  onSaved: (note: string) => void;
}) {
  const [value, setValue] = useState(note);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = value.trim() !== note.trim();

  function save() {
    if (!changed) return;
    startTransition(async () => {
      const result = await saveNote(token, photoId, value);
      if ("error" in result) {
        setStatus("error");
        setMessage(result.error);
      } else {
        setStatus("saved");
        setMessage(null);
        onSaved(result.note);
      }
    });
  }

  return (
    <div className="w-full max-w-md">
      <label className="block text-xs font-bold tracking-wider text-white/70 uppercase" htmlFor={`note-${photoId}`}>
        Note for the photographer
      </label>
      <textarea
        id={`note-${photoId}`}
        value={value}
        maxLength={MAX_NOTE}
        rows={2}
        placeholder="Optional: an editing request or question about this photo"
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
        onBlur={save}
        // Keep ← → typing in the box from flipping photos.
        onKeyDown={(e) => e.stopPropagation()}
        className="mt-1 block w-full resize-none rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-lime focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-white/50">
        <span>
          {pending
            ? "Saving…"
            : status === "saved"
              ? "Saved"
              : status === "error"
                ? <span className="text-sun">{message}</span>
                : `${value.length}/${MAX_NOTE}`}
        </span>
        {changed && !pending && (
          <button type="button" onClick={save} className="font-bold tracking-wider text-lime uppercase hover:underline">
            Save note
          </button>
        )}
      </div>
    </div>
  );
}
