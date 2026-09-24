"use client";

import { useState } from "react";
import { inputClass } from "@/components/form";

// The AI's draft reply, editable here, with a one-click copy for pasting
// into the photographer's email.
export function DraftReply({ draft, to }: { draft: string; to: string | null }) {
  const [text, setText] = useState(draft);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{to ? `To: ${to}` : "Add their email address when you send it."}</p>
        <div className="flex gap-2">
          {text !== draft && (
            <button
              type="button"
              onClick={() => setText(draft)}
              className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
            >
              Reset
            </button>
          )}
          <button type="button" onClick={copy} className="btn-primary px-5 py-2">
            {copied ? "Copied!" : "Copy reply"}
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={14}
        aria-label="Draft reply"
        className={`mt-3 font-sans leading-relaxed ${inputClass}`}
      />
    </div>
  );
}
