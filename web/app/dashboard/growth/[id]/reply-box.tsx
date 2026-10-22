"use client";

import { useState, useTransition } from "react";
import { FormError, inputClass } from "@/components/form";
import { markPosted, saveDraft, scorePost } from "../actions";

// "Score with AI" for a post that hasn't been scored (or failed to be).
export function ScoreWithAi({ id, label = "Score with AI" }: { id: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await scorePost(id);
            setError(result.error ?? null);
          })
        }
        className="btn-primary"
      >
        {pending ? "Scoring… (about 15 seconds)" : label}
      </button>
      <FormError message={error} />
    </div>
  );
}

// The reply: edit the draft, copy it and open the post to paste it, then
// say it's posted. Nothing is ever posted automatically.
export function ReplyBox({
  id,
  postUrl,
  outreachId,
  draft,
  linksAllowed,
}: {
  id: string;
  postUrl: string;
  outreachId: string | null;
  draft: string;
  linksAllowed: boolean;
}) {
  const [text, setText] = useState(draft);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const copyAndOpen = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("Couldn't copy automatically. Select the reply and press Ctrl+C.");
    }
    window.open(postUrl, "_blank", "noopener,noreferrer");
    if (outreachId && text.trim()) startTransition(async () => void (await saveDraft(id, outreachId, text)));
  };

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
        rows={7}
        maxLength={5000}
        aria-label="Your reply"
        placeholder="Write your reply here"
        className={inputClass}
      />
      <p className="text-xs text-muted">
        {text.length} characters{!linksAllowed && " · no links in this group"}
      </p>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!text.trim()} onClick={copyAndOpen} className="btn-primary">
          {copied ? "Copied ✓ Open post again" : "Copy & open post"}
        </button>
        <button
          type="button"
          disabled={pending || !text.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await markPosted(id, outreachId, text);
              setError(result.error ?? null);
            })
          }
          className="btn-secondary"
        >
          {pending ? "Saving…" : "I posted it"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Copy &amp; open post copies the reply and opens the post in a new tab: paste it as a comment (Ctrl+V), then come back and
        click I posted it.
      </p>
    </div>
  );
}
