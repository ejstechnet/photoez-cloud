"use client";

import { useState, useTransition } from "react";
import { GALLERY_STEPS, WorkflowPills } from "@/components/brand";
import { inputClass } from "@/components/form";
import { GALLERY_STATUSES, STATUS_LABELS, STATUS_STEP, type GalleryStatus } from "@/lib/gallery-status";
import { setGalleryStatus } from "../actions";

// What each status means for the client, shown under the steps.
const MEANING: Record<GalleryStatus, string> = {
  pending: "Your client can pick favorites from the proofs.",
  submitted: "Your client submitted their picks. Time to edit!",
  paid_and_submitted: "Your client submitted their picks and paid for extras. Time to edit!",
  delivered: "Your client can view and download their final photos.",
  completed: "All done. Your client can still download their finals.",
  expired: "The gallery is closed to your client.",
};

// The gallery's current stage, like PhotoEZ for WordPress: the same step
// pills clients see, plus a dropdown to change the status by hand.
export function StatusPanel({ galleryId, status }: { galleryId: string; status: GalleryStatus }) {
  const [value, setValue] = useState<GalleryStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: GalleryStatus) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setGalleryStatus(galleryId, next);
      if ("error" in result) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Gallery status</p>
          <p className="mt-0.5 font-display text-2xl font-bold">{STATUS_LABELS[value]}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Change status
          <select
            value={value}
            disabled={pending}
            onChange={(e) => change(e.target.value as GalleryStatus)}
            className={`${inputClass} w-auto py-1.5`}
          >
            {GALLERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <WorkflowPills steps={GALLERY_STEPS} active={STATUS_STEP[value]} />
      </div>
      <p className="mt-3 text-sm text-muted">{MEANING[value]}</p>
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </section>
  );
}
