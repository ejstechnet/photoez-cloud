"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { addPost, type PostFormState } from "../actions";
import { KIND_LABELS } from "../labels";

export type PostPrefill = { url?: string; title?: string; excerpt?: string; sourceId?: string };

// Saving a post: typed in by hand on "Add a post", or filled in by the
// "Save to PhotoEZ Growth" bookmark on the capture page (mode "capture",
// which stays in its small window and says it's saved).
export function PostForm({
  sources,
  prefill,
  prefillKey = 0,
  mode,
}: {
  sources: { id: string; name: string }[];
  prefill?: PostPrefill;
  // Changes when the bookmark sends new text, so the fields refill.
  prefillKey?: number;
  mode?: "capture";
}) {
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(addPost, {});
  const errors = state.errors ?? {};
  // What was typed wins after an attempt; otherwise what the bookmark sent.
  const v = state.values ?? prefill;

  if (state.savedId) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-display text-3xl font-bold">{state.updated ? "Updated ✓" : "Saved ✓"}</p>
        <p className="text-muted">
          {state.updated ? "It was already in your queue; it now has the full text and is being scored again." : "It's in your Growth queue."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href={`/dashboard/growth/${state.savedId}`} target="_blank" rel="noopener" className="btn-secondary">
            Open it
          </a>
          <button type="button" onClick={() => window.close()} className="btn-primary">
            Close this window
          </button>
        </div>
      </div>
    );
  }

  return (
    // A new key after each attempt (or new bookmark text) re-fills the fields.
    <form key={`${prefillKey}-${state.attempt ?? 0}`} action={formAction} className="space-y-4" noValidate>
      {mode && <input type="hidden" name="mode" value={mode} />}
      <Field
        label="Link to the post"
        name="url"
        type="url"
        inputMode="url"
        placeholder="https://www.facebook.com/groups/…/posts/…"
        defaultValue={v?.url}
        error={errors.url}
        hint={mode ? "For a Facebook group post, open the post itself (click its date) so this is the post's own link." : undefined}
        required
      />
      <TextAreaField
        label="What they wrote"
        name="excerpt"
        rows={6}
        defaultValue={v?.excerpt}
        error={errors.excerpt}
        hint="Paste the post's text. This is what gets scored, so include the question they asked."
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Where it's from" name="sourceId" defaultValue={v?.sourceId ?? sources[0]?.id ?? ""} error={errors.sourceId}>
          <option value="">Somewhere else</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="This is"
          name="kind"
          defaultValue={state.values?.kind ?? "sales_opportunity"}
          error={errors.kind}
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Title"
          name="title"
          defaultValue={v?.title}
          error={errors.title}
          hint="Optional. A thread title, or a few words to find it by."
        />
        <Field
          label="Their name as shown"
          name="authorLabel"
          defaultValue={state.values?.authorLabel}
          error={errors.authorLabel}
          hint="Optional. Only the name on the post, nothing more."
        />
      </div>
      <Field
        label="Posted on"
        name="publishedAt"
        type="date"
        defaultValue={state.values?.publishedAt}
        error={errors.publishedAt}
        hint="Optional, but it counts toward the score."
      />

      <FormError message={state.message} />
      {state.duplicateId && (
        <p>
          <a href={`/dashboard/growth/${state.duplicateId}`} target={mode ? "_blank" : undefined} rel="noopener" className="link font-semibold">
            Open the saved post →
          </a>
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          Save post
        </SubmitButton>
        {mode ? (
          <button type="button" onClick={() => window.close()} className="btn-secondary">
            Cancel
          </button>
        ) : (
          <Link href="/dashboard/growth" className="btn-secondary">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
