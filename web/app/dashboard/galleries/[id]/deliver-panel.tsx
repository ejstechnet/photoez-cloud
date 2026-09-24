"use client";

import { useState, useTransition } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { deliverGallery, undoDelivery } from "../actions";

// Sends the finals to the client (their link becomes the delivery page), or
// shows when the gallery was delivered with an option to take it back.
export function DeliverPanel({
  galleryId,
  finalsCount,
  deliveredAt,
}: {
  galleryId: string;
  finalsCount: number;
  deliveredAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (deliveredAt) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-lime/60 bg-lime/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-semibold">
            Delivered{" "}
            {new Date(deliveredAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
          </span>{" "}
          <span className="text-muted">Your client can view and download their final photos from their link.</span>
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            confirm("Take this delivery back? Your client won't see the finals until you deliver again.") &&
            startTransition(() => undoDelivery(galleryId))
          }
          className="btn-secondary shrink-0"
        >
          {pending ? "Undoing…" : "Undo delivery"}
        </button>
      </div>
    );
  }

  function deliver() {
    const noun = finalsCount === 1 ? "photo" : "photos";
    if (!confirm(`Deliver ${finalsCount} final ${noun}? Your client's link will switch to their download page.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deliverGallery(galleryId);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        <span className="font-semibold">
          {finalsCount === 0
            ? "No finals yet."
            : `${finalsCount} final ${finalsCount === 1 ? "photo" : "photos"} ready.`}
        </span>{" "}
        <span className="text-muted">
          {finalsCount === 0 ? "Upload your edited photos below, then deliver them." : "Deliver when everything's uploaded."}
        </span>
        {error && <span className="mt-1 block font-medium text-danger">{error}</span>}
      </p>
      <button type="button" onClick={deliver} disabled={pending || finalsCount === 0} className="btn-primary shrink-0">
        {pending ? "Delivering…" : "Deliver to client"} <ArrowRightIcon size={18} />
      </button>
    </div>
  );
}
