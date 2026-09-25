"use client";

import { useState, useTransition } from "react";
import { saveInspoMode } from "../field-actions";

const MODES = [
  { value: "off", label: "Off", note: "No upload on the booking form." },
  { value: "optional", label: "Optional", note: "Clients may add up to 10 images." },
  { value: "required", label: "Required", note: "Clients must add at least one." },
] as const;

// Inspiration photos on the booking form, saved as soon as it's changed.
export function InspoMode({ mode }: { mode: string }) {
  const [value, setValue] = useState(mode);
  const [pending, startTransition] = useTransition();

  return (
    <fieldset>
      <legend className="text-sm font-semibold">Inspiration photos</legend>
      <p className="text-xs text-muted">Clients can upload looks, poses, or outfits they love when they book.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`cursor-pointer rounded-xl border-2 px-3.5 py-2.5 transition ${
              value === m.value ? "border-lime bg-lime/10" : "border-border hover:border-muted"
            }`}
          >
            <input
              type="radio"
              name="inspoMode"
              value={m.value}
              checked={value === m.value}
              disabled={pending}
              onChange={() => {
                setValue(m.value);
                startTransition(() => saveInspoMode(m.value));
              }}
              className="sr-only"
            />
            <span className="block text-sm font-semibold">{m.label}</span>
            <span className="block text-xs text-muted">{m.note}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
