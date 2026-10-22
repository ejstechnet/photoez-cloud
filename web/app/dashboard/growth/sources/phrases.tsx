"use client";

import { useState, useTransition } from "react";
import { FormError, inputClass } from "@/components/form";
import { GROWTH_KEYWORD_GROUPS } from "@/lib/growth/constants";
import { addPhrase, removePhrase, togglePhrase } from "./actions";

const GROUP_LABELS: Record<(typeof GROWTH_KEYWORD_GROUPS)[number], string> = {
  alternatives: "Switching from another app",
  proofing_galleries: "Galleries, proofing and delivery",
  business_management: "Running the business",
  buying_intent: "Asking what to use",
  negative: "Skip posts about",
};

type Phrase = { id: string; group: (typeof GROWTH_KEYWORD_GROUPS)[number]; phrase: string; enabled: boolean };

// The search phrases: what Google Alerts should be set up for, and what
// keeps a feed of every new thread down to the posts that matter.
export function Phrases({ phrases }: { phrases: Phrase[] }) {
  const [pending, startTransition] = useTransition();
  const [group, setGroup] = useState<Phrase["group"]>("buying_intent");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {GROWTH_KEYWORD_GROUPS.map((g) => (
        <div key={g}>
          <h3 className="text-sm font-bold tracking-wider text-muted uppercase">{GROUP_LABELS[g]}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {phrases
              .filter((p) => p.group === g)
              .map((p) => (
                <li key={p.id} className={`flex items-center gap-1 rounded-full border-2 border-border px-3 py-1 text-sm ${p.enabled ? "" : "opacity-50"}`}>
                  <button type="button" disabled={pending} title={p.enabled ? "Turn off" : "Turn on"} onClick={() => startTransition(() => togglePhrase(p.id, !p.enabled))}>
                    {p.phrase}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Delete ${p.phrase}`}
                    onClick={() => startTransition(() => removePhrase(p.id))}
                    className="ml-1 text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <form
        className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await addPhrase(group, text);
            setError(result.error ?? null);
            if (!result.error) setText("");
          });
        }}
      >
        <select value={group} onChange={(e) => setGroup(e.target.value as Phrase["group"])} aria-label="Group" className={inputClass}>
          {GROWTH_KEYWORD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {GROUP_LABELS[g]}
            </option>
          ))}
        </select>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="how do you deliver photos to clients" aria-label="New phrase" className={inputClass} />
        <button type="submit" disabled={pending || !text.trim()} className="btn-primary">
          Add phrase
        </button>
      </form>
      <FormError message={error} />
      <p className="text-xs text-muted">Click a phrase to turn it off or on.</p>
    </div>
  );
}
