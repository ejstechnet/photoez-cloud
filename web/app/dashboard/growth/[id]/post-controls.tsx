"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FormError, inputClass } from "@/components/form";
import { GROWTH_STATUSES, type GrowthStatus } from "@/lib/growth/constants";
import { NEEDS_EVIDENCE, STATUS_LABELS } from "@/lib/growth/pipeline";
import { movePost, notePost, overrideScore, removePost, scheduleNextAction, type ActionResult } from "../actions";

// The small forms on a saved post's page. Each one calls a server action,
// shows its problem (if any) right underneath, and its button says "Saved ✓"
// for a moment afterwards so it's clear the change went through.

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (action: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const result = await action();
      setError(result.error ?? null);
      if (result.error) return;
      after?.();
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    });
  return { pending, error, saved, run };
}

// A form's main button: "Saving…" while it works, then "Saved ✓".
function SaveButton({ pending, saved, disabled, children }: { pending: boolean; saved: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={pending || disabled} className="btn-primary" aria-live="polite">
      {pending ? "Saving…" : saved ? "Saved ✓" : children}
    </button>
  );
}

export function StatusForm({ id, status }: { id: string; status: GrowthStatus }) {
  const { pending, error, saved, run } = useAction();
  const [to, setTo] = useState<GrowthStatus>(status);
  const [evidence, setEvidence] = useState("");
  const needsEvidence = NEEDS_EVIDENCE.includes(to);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => movePost(id, to, evidence), () => setEvidence(""));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <select value={to} onChange={(e) => setTo(e.target.value as GrowthStatus)} aria-label="New status" className={inputClass}>
          {GROWTH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          maxLength={2000}
          aria-label="What happened"
          placeholder={needsEvidence ? "What happened? (needed)" : "What happened? (optional)"}
          className={inputClass}
        />
      </div>
      <FormError message={error} />
      <SaveButton pending={pending} saved={saved} disabled={to === status}>
        Save change
      </SaveButton>
    </form>
  );
}

export function ScoreForm({ id, override, reason }: { id: string; override: number | null; reason: string | null }) {
  const { pending, error, saved, run } = useAction();
  const [score, setScore] = useState(override === null ? "" : String(override));
  const [why, setWhy] = useState(reason ?? "");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => overrideScore(id, score, why));
      }}
    >
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <input
          value={score}
          onChange={(e) => setScore(e.target.value)}
          inputMode="numeric"
          placeholder="0–100"
          aria-label="Your score"
          className={inputClass}
        />
        <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={500} placeholder="Why (optional)" aria-label="Why" className={inputClass} />
      </div>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <SaveButton pending={pending} saved={saved} disabled={score.trim() === ""}>
          Save score
        </SaveButton>
        {override !== null && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => overrideScore(id, "", ""), () => (setScore(""), setWhy("")))}
            className="btn-secondary"
          >
            Clear my score
          </button>
        )}
      </div>
    </form>
  );
}

export function NextActionForm({ id, day }: { id: string; day: string }) {
  const { pending, error, saved, run } = useAction();
  const [value, setValue] = useState(day);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => scheduleNextAction(id, value));
      }}
    >
      <input type="date" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Follow up on" className={inputClass} />
      <FormError message={error} />
      <SaveButton pending={pending} saved={saved} disabled={value === day}>
        {value || !day ? "Set reminder" : "Clear reminder"}
      </SaveButton>
    </form>
  );
}

export function NoteForm({ id }: { id: string }) {
  const { pending, error, saved, run } = useAction();
  const [body, setBody] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => notePost(id, body), () => setBody(""));
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={5000}
        placeholder="Anything worth remembering"
        aria-label="Note"
        className={inputClass}
      />
      <FormError message={error} />
      <SaveButton pending={pending} saved={saved} disabled={!body.trim()}>
        Add note
      </SaveButton>
    </form>
  );
}

export function DeletePost({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Delete this post, its notes and its history? This can't be undone.")) startTransition(() => removePost(id));
      }}
      className="text-sm font-semibold text-danger hover:underline"
    >
      {pending ? "Deleting…" : "Delete this post"}
    </button>
  );
}
