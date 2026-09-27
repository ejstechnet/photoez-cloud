"use client";

import { useState, useTransition } from "react";
import { emailGalleryToClient, reopenProofing, requestGalleryReview } from "../actions";

// The gallery's private client link, with copy and preview buttons, and a
// summary of what the client has picked so far.
export function ClientLink({
  galleryId,
  url,
  submitted,
  canReopen,
  selectedNames,
  notes,
  freeLimit,
  clientName,
  clientEmail,
  delivered,
  reviewStatus,
}: {
  galleryId: string;
  url: string;
  submitted: boolean;
  // Any stage after proofing: submitted, delivered, completed, or expired.
  canReopen: boolean;
  selectedNames: string[];
  // The client's notes on their picks, by file name.
  notes: { name: string; note: string }[];
  freeLimit: number;
  clientName: string | null;
  // Where "Email gallery link" sends the link; null when the client has no email.
  clientEmail: string | null;
  delivered: boolean;
  // This gallery's review so far: null = not asked yet.
  reviewStatus: "requested" | "submitted" | "approved" | "rejected" | null;
}) {
  const [copied, setCopied] = useState<"link" | "names" | null>(null);
  const [reopening, startReopen] = useTransition();
  const [emailing, startEmail] = useTransition();
  const [emailResult, setEmailResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [asking, startAsk] = useTransition();

  function askForReview() {
    if (!clientEmail) return;
    const again = reviewStatus === "requested";
    if (!confirm(`${again ? "Send the review request again" : "Ask for a review"}: email ${clientEmail}?`)) return;
    setEmailResult(null);
    startAsk(async () => {
      const result = await requestGalleryReview(galleryId);
      setEmailResult(
        "ok" in result ? { ok: true, text: `Review request sent to ${result.to}.` } : { ok: false, text: result.error },
      );
    });
  }

  function emailClient() {
    if (!clientEmail) return;
    const what = delivered ? "the download link for their final photos" : "their gallery link";
    if (!confirm(`Email ${what} to ${clientEmail}?`)) return;
    setEmailResult(null);
    startEmail(async () => {
      const result = await emailGalleryToClient(galleryId);
      setEmailResult("ok" in result ? { ok: true, text: `Emailed to ${result.to}.` } : { ok: false, text: result.error });
    });
  }

  async function copy(text: string, what: "link" | "names") {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Client gallery link</p>
          <p className="mt-1 truncate font-mono text-sm">{url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy(url, "link")} className="btn-primary px-5 py-2.5">
            {copied === "link" ? "Copied!" : "Copy link"}
          </button>
          <a href={`${url}?preview=1`} target="_blank" rel="noreferrer" className="btn-secondary">
            Preview as client
          </a>
        </div>
      </div>

      {/* Reaching the client: the gallery link by email, and a review request once delivered. */}
      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Client</p>
          <p className="mt-1 truncate text-sm">
            <span className="font-semibold">{clientName ?? "No client"}</span>
            {clientEmail ? (
              <>
                {" · "}
                <a href={`mailto:${clientEmail}`} className="link">
                  {clientEmail}
                </a>
              </>
            ) : (
              <span className="text-muted"> · no email address yet</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={emailClient}
            disabled={!clientEmail || emailing}
            title={clientEmail ? undefined : "Add the client's email address to send the link"}
            className="btn-secondary"
          >
            {emailing ? "Sending…" : delivered ? "Email download link" : "Email gallery link"}
          </button>
          {delivered && (reviewStatus === null || reviewStatus === "requested") && (
            <button
              type="button"
              onClick={askForReview}
              disabled={!clientEmail || asking}
              title={clientEmail ? undefined : "Add the client's email address to ask for a review"}
              className="btn-secondary"
            >
              {asking ? "Sending…" : reviewStatus === "requested" ? "Ask again for review" : "Ask for a review"}
            </button>
          )}
          {reviewStatus && reviewStatus !== "requested" && (
            <a href="/dashboard/reviews" className="btn-secondary">
              {reviewStatus === "approved" ? "★ Review published" : reviewStatus === "submitted" ? "★ New review" : "Review hidden"}
            </a>
          )}
        </div>
      </div>

      {emailResult && (
        <p role="status" className={`mt-3 text-sm font-semibold ${emailResult.ok ? "text-lime-ink" : "text-danger"}`}>
          {emailResult.ok ? "✓ " : ""}
          {emailResult.text}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-semibold">
            {submitted ? "Client submitted " : "Client has picked "}
            {freeLimit > 0 ? `${selectedNames.length} of ${freeLimit}` : selectedNames.length}{" "}
            {selectedNames.length === 1 ? "photo" : "photos"}
          </span>
          {selectedNames.length > 0 && <span className="text-muted"> · marked with a heart below</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {selectedNames.length > 0 && (
            <button
              type="button"
              onClick={() => copy(selectedNames.join(" "), "names")}
              className="btn-secondary"
              title="Paste into Lightroom's filename search to find the picks"
            >
              {copied === "names" ? "Copied!" : "Copy file names"}
            </button>
          )}
          {canReopen && (
            <button
              type="button"
              disabled={reopening}
              onClick={() =>
                confirm(
                  "Reopen selections so the client can change their picks? If the gallery was delivered, their link goes back to proofing until you deliver again. Picks and finals are kept.",
                ) &&
                startReopen(() => reopenProofing(galleryId))
              }
              className="btn-secondary"
            >
              {reopening ? "Reopening…" : "Reopen selections"}
            </button>
          )}
        </div>
      </div>
      {notes.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-semibold">Client notes ({notes.length})</p>
          <ul className="mt-2 space-y-2">
            {notes.map((n) => (
              <li key={n.name} className="rounded-xl bg-sun/20 px-3.5 py-2.5 text-sm">
                <span className="font-mono text-xs font-bold">{n.name}</span>
                <span className="mt-0.5 block whitespace-pre-line">{n.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
