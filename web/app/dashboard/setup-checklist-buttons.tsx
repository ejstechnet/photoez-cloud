"use client";

import { useState, useTransition } from "react";
import { dismissSetupChecklist, markStudioLinkCopied } from "./setup-actions";

// "Copy link" on the checklist's last step: copies the studio page address and
// ticks the step off.
export function CopyStudioLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();

  return (
    <button
      type="button"
      className="btn-primary shrink-0 px-4 py-2 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        start(() => markStudioLinkCopied());
      }}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

// Hides the welcome checklist for good.
export function HideSetupChecklist() {
  const [working, start] = useTransition();

  return (
    <button
      type="button"
      className="text-xs font-semibold text-muted underline underline-offset-4 hover:text-foreground"
      disabled={working}
      onClick={() => start(() => dismissSetupChecklist())}
    >
      {working ? "Hiding…" : "Hide this"}
    </button>
  );
}
