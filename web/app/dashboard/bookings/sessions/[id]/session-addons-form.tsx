"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton, inputClass } from "@/components/form";
import type { SessionAddonsState } from "../../addon-actions";

type Row = { id: string; name: string; price: string; offered: boolean; included: number };

// Tick the add-ons this session offers, and how many of each come with it
// (e.g. 15 edited photos included; more at the add-on's price).
export function SessionAddonsForm({
  action,
  rows,
}: {
  action: (state: SessionAddonsState, formData: FormData) => Promise<SessionAddonsState>;
  rows: Row[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [offered, setOffered] = useState(() => new Set(rows.filter((r) => r.offered).map((r) => r.id)));

  return (
    <form action={formAction} className="space-y-4">
      <ul className="divide-y divide-border rounded-2xl border-2 border-border">
        {rows.map((row) => {
          const on = offered.has(row.id);
          return (
            <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <label className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  name="offer"
                  value={row.id}
                  checked={on}
                  onChange={(e) =>
                    setOffered((current) => {
                      const next = new Set(current);
                      if (e.target.checked) next.add(row.id);
                      else next.delete(row.id);
                      return next;
                    })
                  }
                  className="size-4 shrink-0 accent-lime-ink"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{row.name}</span>
                  <span className="block text-xs text-muted">{row.price} each</span>
                </span>
              </label>
              {on && (
                <label className="flex items-center gap-2 text-sm">
                  Included
                  <input
                    type="number"
                    name={`included.${row.id}`}
                    min={0}
                    max={500}
                    defaultValue={row.included}
                    className={`${inputClass} w-20 py-1.5`}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <FormError message={state.message} />
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending} fullWidth={false}>
          Save add-ons
        </SubmitButton>
        {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
      </div>
    </form>
  );
}
