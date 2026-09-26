"use client";

import { useState, useTransition } from "react";
import { savePhotoNotes } from "./actions";

// Studio-wide switch for client notes on picks (each gallery can override it
// in its own settings), saved as soon as it's changed.
export function NotesToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  return (
    <label className="mt-6 flex items-start gap-3 border-t border-border pt-6">
      <input
        type="checkbox"
        checked={on}
        disabled={pending}
        onChange={(e) => {
          setOn(e.target.checked);
          startTransition(() => savePhotoNotes(e.target.checked));
        }}
        className="mt-1 size-4 accent-lime-ink"
      />
      <span>
        <span className="block text-sm font-semibold">Let clients add notes to their picks</span>
        <span className="block text-xs text-muted">
          Clients can leave an editing request or question on each photo they choose. You can turn this on or off for
          a single gallery in its settings.
        </span>
      </span>
    </label>
  );
}
