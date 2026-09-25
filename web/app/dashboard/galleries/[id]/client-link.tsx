"use client";

import { useState, useTransition } from "react";
import { reopenProofing } from "../actions";

// The gallery's private client link, with copy and preview buttons, and a
// summary of what the client has picked so far.
export function ClientLink({
  galleryId,
  url,
  submitted,
  canReopen,
  selectedNames,
  freeLimit,
}: {
  galleryId: string;
  url: string;
  submitted: boolean;
  // Any stage after proofing: submitted, delivered, completed, or expired.
  canReopen: boolean;
  selectedNames: string[];
  freeLimit: number;
}) {
  const [copied, setCopied] = useState<"link" | "names" | null>(null);
  const [reopening, startReopen] = useTransition();

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
    </section>
  );
}
