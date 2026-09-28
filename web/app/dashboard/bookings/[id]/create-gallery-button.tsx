"use client";

import { useState, useTransition } from "react";
import { createBookingGallery } from "../actions";

// "Create gallery" on a booking without one (its session is set to "no
// gallery", or the plan's gallery limit stopped the automatic one).
export function CreateGalleryButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await createBookingGallery(bookingId);
            if (result?.message) setMessage(result.message);
          })
        }
      >
        {pending ? "Creating…" : "Create gallery"}
      </button>
      {message && <p className="max-w-sm text-right text-sm font-semibold text-danger">{message}</p>}
    </div>
  );
}
