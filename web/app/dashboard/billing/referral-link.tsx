"use client";

import { useState } from "react";

// The studio's referral link with a Copy button.
export function ReferralLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Your referral link"
        className="h-11 min-w-0 flex-1 rounded-full border-2 border-border bg-background px-4 text-sm font-semibold"
      />
      <button
        type="button"
        className="btn-primary h-11 py-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked: the link is selectable in the box.
          }
        }}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
