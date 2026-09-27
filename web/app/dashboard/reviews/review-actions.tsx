"use client";

import { useTransition } from "react";
import { deleteReview, screenReview } from "./actions";

// Approve / hide / unpublish / delete buttons for one review.
export function ReviewActions({ reviewId, status }: { reviewId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const run = (work: () => Promise<void>) => startTransition(work);
  const secondary =
    "rounded-full px-3 py-1.5 text-xs font-bold tracking-wider uppercase text-muted transition hover:bg-background hover:text-foreground disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "submitted" && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => screenReview(reviewId, "approve"))}
            className="btn-primary px-4 py-2 text-xs"
          >
            {pending ? "Saving…" : "Approve & publish"}
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => screenReview(reviewId, "hide"))} className={secondary}>
            Hide
          </button>
        </>
      )}
      {status === "approved" && (
        <button type="button" disabled={pending} onClick={() => run(() => screenReview(reviewId, "unpublish"))} className={secondary}>
          Unpublish
        </button>
      )}
      {status === "rejected" && (
        <button type="button" disabled={pending} onClick={() => run(() => screenReview(reviewId, "approve"))} className={secondary}>
          Publish after all
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm("Delete this review for good?") && run(() => deleteReview(reviewId))}
        className="rounded-full px-3 py-1.5 text-xs font-bold tracking-wider text-danger uppercase transition hover:bg-danger/10 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
