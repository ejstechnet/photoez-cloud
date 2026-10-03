"use client";

import { useState, useTransition } from "react";
import { FormError, inputClass } from "@/components/form";
import { approveQuote, declineQuote } from "./actions";

// Approve or decline a quote. Declining asks for an optional reason.
export function QuoteAnswer({ token }: { token: string }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (work: () => Promise<{ message?: string }>) =>
    start(async () => {
      setMessage(null);
      const result = await work();
      if (result?.message) setMessage(result.message);
    });

  if (declining) {
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold">Anything you&apos;d like to share? (optional)</span>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`mt-1.5 ${inputClass}`} />
        </label>
        <FormError message={message} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" disabled={pending} onClick={() => run(() => declineQuote(token, reason))} className="btn-secondary">
            {pending ? "Please wait…" : "Decline quote"}
          </button>
          <button type="button" onClick={() => setDeclining(false)} className="text-sm font-semibold text-muted underline">
            Never mind
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <FormError message={message} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" disabled={pending} onClick={() => run(() => approveQuote(token))} className="btn-primary">
          {pending ? "Please wait…" : "Approve quote"}
        </button>
        <button type="button" onClick={() => setDeclining(true)} className="text-sm font-semibold text-muted underline hover:text-foreground">
          Decline
        </button>
      </div>
    </div>
  );
}
