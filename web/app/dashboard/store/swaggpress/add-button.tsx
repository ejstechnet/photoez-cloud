"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addSwaggToStore } from "../actions";

// "Add to my store" for one SwaggPress product (or "Edit prices" once added).
export function AddSwaggButton({ labProductId, addedId }: { labProductId: number; addedId: string | null }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  if (addedId) {
    return (
      <Link href={`/dashboard/store/products/${addedId}`} className="btn-secondary w-full px-4 py-2 text-xs">
        ✓ In your store · Edit prices
      </Link>
    );
  }
  return (
    <div>
      <button
        type="button"
        className="btn-primary w-full px-4 py-2 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await addSwaggToStore(labProductId);
            if (result?.message) setMessage(result.message);
          })
        }
      >
        {pending ? "Adding…" : "Add to my store"}
      </button>
      {message && <p className="mt-1.5 text-xs font-semibold text-danger">{message}</p>}
    </div>
  );
}
