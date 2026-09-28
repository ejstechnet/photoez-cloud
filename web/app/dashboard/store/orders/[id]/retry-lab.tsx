"use client";

import { useState, useTransition } from "react";
import { retryLabOrder } from "../../actions";

// "Send to SwaggPress again" after a failure (e.g. the card on file was declined).
export function RetryLab({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <button
        type="button"
        className="btn-primary px-4 py-2 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await retryLabOrder(orderId);
            setMessage(result.message ?? null);
          })
        }
      >
        {pending ? "Sending…" : "Send to SwaggPress again"}
      </button>
      {message && <p className="mt-2 text-sm font-semibold text-danger">{message}</p>}
    </div>
  );
}
