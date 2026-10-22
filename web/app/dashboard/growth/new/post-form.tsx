"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { addPost, type PostFormState } from "../actions";
import { KIND_LABELS } from "../labels";

// Saving a post by hand. (Step 1.3 adds a one-click bookmark that fills this in.)
export function PostForm({ sources }: { sources: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<PostFormState, FormData>(addPost, {});
  const errors = state.errors ?? {};
  const v = state.values;

  return (
    // A new key after each attempt re-fills the fields with what was typed.
    <form key={state.attempt ?? 0} action={formAction} className="space-y-4" noValidate>
      <Field
        label="Link to the post"
        name="url"
        type="url"
        inputMode="url"
        placeholder="https://www.facebook.com/groups/…/posts/…"
        defaultValue={v?.url}
        error={errors.url}
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
        <SelectField label="This is" name="kind" defaultValue={v?.kind ?? "sales_opportunity"} error={errors.kind}>
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
          defaultValue={v?.authorLabel}
          error={errors.authorLabel}
          hint="Optional. Only the name on the post, nothing more."
        />
      </div>
      <Field
        label="Posted on"
        name="publishedAt"
        type="date"
        defaultValue={v?.publishedAt}
        error={errors.publishedAt}
        hint="Optional, but it counts toward the score."
      />

      <FormError message={state.message} />
      {state.duplicateId && (
        <p>
          <Link href={`/dashboard/growth/${state.duplicateId}`} className="link font-semibold">
            Open the saved post →
          </Link>
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          Save post
        </SubmitButton>
        <Link href="/dashboard/growth" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
