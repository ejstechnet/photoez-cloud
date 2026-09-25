"use client";

import { useState, useTransition } from "react";
import { cancelBooking } from "./actions";

// Cancel with a clear confirmation of what happens to the deposit.
export function CancelButton({ token, consequence }: { token: string; consequence: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    if (!confirm(`Cancel this booking?\n\n${consequence}\n\nThis can't be undone online.`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await cancelBooking(token);
      if (result?.message) setMessage(result.message);
    });
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-full border-2 border-danger/40 px-5 py-2.5 text-sm font-bold tracking-wider text-danger uppercase transition hover:bg-danger/10 disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel booking"}
      </button>
      {message && (
        <span role="alert" className="text-sm font-medium text-danger">
          {message}
        </span>
      )}
    </span>
  );
}
