"use client";

import { useState, useTransition } from "react";
import { FormError, inputClass } from "@/components/form";
import { recordPayment, sendInvoice } from "../actions";

// Send (or send again) with an optional personal note in the email.
export function SendButton({ id, label, email }: { id: string; label: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">
          {label}
        </button>
        {result?.ok && <p className="mt-2 text-sm font-semibold text-lime-ink">Sent to {email} ✓</p>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-semibold">Add a note (optional)</span>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="So excited to work with you!" className={`mt-1.5 ${inputClass}`} />
      </label>
      {result?.message && <FormError message={result.message} />}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await sendInvoice(id, note);
              setResult(r.message ? r : { ok: true });
              if (!r.message) {
                setOpen(false);
                setNote("");
              }
            })
          }
          className="btn-primary flex-1"
        >
          {pending ? "Sending…" : `Send to ${email}`}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}

// A payment made outside PhotoEZ Cloud: cash, check, Venmo, Zelle.
export function RecordPaymentForm({ id, today }: { id: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ amount: "", note: "", date: today });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-lime-ink hover:underline">
        + Record a payment (cash, check…)
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl bg-background p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold">Amount</span>
          <input inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="$0.00" className={`mt-1.5 ${inputClass}`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Date</span>
          <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={`mt-1.5 ${inputClass}`} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-semibold">How they paid</span>
        <input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Cash, check #104, Venmo…" className={`mt-1.5 ${inputClass}`} />
      </label>
      <FormError message={message} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMessage(null);
              const r = await recordPayment(id, v);
              if (r.message) setMessage(r.message);
              else {
                setOpen(false);
                setV({ amount: "", note: "", date: today });
              }
            })
          }
          className="btn-primary flex-1"
        >
          {pending ? "Saving…" : "Record payment"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
