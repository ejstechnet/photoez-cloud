"use client";

import { useActionState, useState } from "react";
import { FormError, SubmitButton, inputClass } from "@/components/form";
import { saveFaqs } from "./actions";

type Row = { key: number; question: string; answer: string };

// The studio's client FAQ: saved answers first, then suggested questions
// waiting for an answer. Only answered questions are saved and shown.
export function FaqForm({ saved, suggestions }: { saved: { question: string; answer: string }[]; suggestions: string[] }) {
  const [state, formAction, pending] = useActionState(saveFaqs, {});
  const [rows, setRows] = useState<Row[]>(() =>
    [...saved, ...suggestions.map((question) => ({ question, answer: "" }))].map((row, key) => ({ ...row, key })),
  );
  const [nextKey, setNextKey] = useState(rows.length);
  const answered = rows.filter((row) => row.answer.trim() !== "").length;

  const update = (key: number, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const move = (index: number, by: number) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm font-semibold text-lime-ink">
        {answered === 1 ? "1 question answered" : `${answered} questions answered`}
      </p>
      <ol className="space-y-3">
        {rows.map((row, i) => {
          const empty = row.answer.trim() === "";
          return (
            <li
              key={row.key}
              className={`rounded-2xl border-2 p-4 transition ${empty ? "border-dashed border-border" : "border-lime/60"}`}
            >
              <div className="flex items-start gap-2">
                <input
                  name="question"
                  value={row.question}
                  onChange={(e) => update(row.key, { question: e.target.value })}
                  aria-label={`Question ${i + 1}`}
                  placeholder="Your question"
                  maxLength={200}
                  className={`${inputClass} font-semibold`}
                />
                <div className="flex shrink-0 gap-1 pt-1.5">
                  <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </IconButton>
                  <IconButton label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </IconButton>
                  <IconButton label="Remove" onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}>
                    ✕
                  </IconButton>
                </div>
              </div>
              <textarea
                name="answer"
                value={row.answer}
                onChange={(e) => update(row.key, { answer: e.target.value })}
                aria-label={`Answer to: ${row.question || `question ${i + 1}`}`}
                placeholder="Your answer. Leave blank to skip this question."
                rows={empty ? 1 : 3}
                maxLength={2000}
                className={`${inputClass} mt-2`}
              />
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => {
          setRows((current) => [...current, { key: nextKey, question: "", answer: "" }]);
          setNextKey(nextKey + 1);
        }}
        className="btn-secondary"
      >
        + Add your own question
      </button>
      <FormError message={state.message} />
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending} fullWidth={false}>
          Save FAQ
        </SubmitButton>
        {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
      </div>
    </form>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-sm font-bold text-muted transition hover:bg-border hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}
