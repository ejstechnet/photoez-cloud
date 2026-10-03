"use client";

import { useState, useTransition } from "react";
import { FormError, inputClass } from "@/components/form";
import { saveInvoiceDefaults } from "./actions";

// Invoices > Defaults: tax rate, deposit, and terms for new quotes and invoices.
export function DefaultsForm(initial: { taxRate: string; depositPercent: string; terms: string }) {
  const [v, setV] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setMessage(null);
      const result = await saveInvoiceDefaults(v);
      if (result.message) setMessage(result.message);
      setSaved(Boolean(result.saved));
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold">Tax rate (%)</span>
          <input inputMode="decimal" value={v.taxRate} onChange={(e) => setV({ ...v, taxRate: e.target.value })} placeholder="0" className={`mt-1.5 ${inputClass}`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Deposit (%)</span>
          <input inputMode="numeric" value={v.depositPercent} onChange={(e) => setV({ ...v, depositPercent: e.target.value })} className={`mt-1.5 ${inputClass}`} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-semibold">Terms</span>
        <textarea
          rows={5}
          value={v.terms}
          onChange={(e) => setV({ ...v, terms: e.target.value })}
          placeholder="e.g. Deposits are non-refundable and hold your date."
          className={`mt-1.5 ${inputClass}`}
        />
      </label>
      <FormError message={message} />
      <button type="button" onClick={save} disabled={pending} className="btn-secondary w-full">
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save defaults"}
      </button>
    </div>
  );
}
