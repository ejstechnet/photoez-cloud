"use client";

import { useState, useTransition } from "react";
import { inputClass } from "@/components/form";
import { sendReply } from "../actions";

// The AI's draft reply, editable here: send it by email from your studio, or
// copy it to paste into your own email.
export function DraftReply({
  inquiryId,
  draft,
  to,
  sentAt,
  autoSent,
}: {
  inquiryId: string;
  draft: string;
  to: string | null;
  // When a reply was already emailed, and whether it went out on its own.
  sentAt: string | null;
  autoSent: boolean;
}) {
  const [text, setText] = useState(draft);
  const [copied, setCopied] = useState(false);
  const [sending, startSending] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function send() {
    if (!to) return;
    if (sentAt && !confirm("A reply was already sent. Send this one too?")) return;
    setMessage(null);
    startSending(async () => {
      const result = await sendReply(inquiryId, text);
      setMessage("ok" in result ? { ok: true, text: `Sent to ${to}.` } : { ok: false, text: result.error });
    });
  }

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
          <button type="button" onClick={copy} className="btn-secondary px-5 py-2">
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!to || sending}
            className="btn-primary px-5 py-2"
            title={to ? undefined : "There's no email address to send to."}
          >
            {sending ? "Sending…" : "Send email"}
          </button>
        </div>
      </div>
      {sentAt && !message && (
        <p className="mt-3 rounded-xl bg-lime/15 px-4 py-2 text-sm font-semibold text-lime-ink">
          ✓ {autoSent ? "Sent automatically" : "Reply sent"} {sentAt}
        </p>
      )}
      {message && (
        <p
          role="status"
          className={`mt-3 rounded-xl px-4 py-2 text-sm font-semibold ${message.ok ? "bg-lime/15 text-lime-ink" : "bg-danger/10 text-danger"}`}
        >
          {message.ok ? "✓ " : ""}
          {message.text}
        </p>
      )}
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
