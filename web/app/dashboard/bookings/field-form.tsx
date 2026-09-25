"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { BOOKING_FIELD_TYPES, FIELD_TYPE_LABELS, type BookingFieldType } from "@/lib/booking/fields";
import type { FieldFormState } from "./field-actions";

export type FieldValues = {
  label: string;
  type: BookingFieldType;
  options: string[];
  required: boolean;
  sessionTypeIds: string[];
};

// Add/edit form for a custom booking question.
export function FieldForm({
  action,
  sessions,
  defaultValues,
  submitLabel,
}: {
  action: (state: FieldFormState, formData: FormData) => Promise<FieldFormState>;
  sessions: { id: string; name: string }[];
  defaultValues?: FieldValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [type, setType] = useState<BookingFieldType>(defaultValues?.type ?? "text");
  const [some, setSome] = useState((defaultValues?.sessionTypeIds.length ?? 0) > 0);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label="Question"
        name="label"
        defaultValue={defaultValues?.label}
        error={errors.label}
        placeholder="How many outfit changes are you planning?"
        required
      />
      <SelectField
        label="Answer type"
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value as BookingFieldType)}
        error={errors.type}
      >
        {BOOKING_FIELD_TYPES.map((t) => (
          <option key={t} value={t}>
            {FIELD_TYPE_LABELS[t]}
          </option>
        ))}
      </SelectField>
      {type === "select" && (
        <TextAreaField
          label="Choices"
          name="options"
          rows={4}
          defaultValue={defaultValues?.options.join("\n") ?? ""}
          error={errors.options}
          hint="One choice per line."
        />
      )}
      <label className="flex items-start gap-3 rounded-xl border-2 border-border px-3.5 py-3">
        <input type="checkbox" name="required" defaultChecked={defaultValues?.required ?? false} className="mt-1 size-4 accent-lime-ink" />
        <span>
          <span className="block text-sm font-semibold">Required</span>
          <span className="block text-xs text-muted">
            {type === "checkbox" ? "Clients must tick the box to book (good for agreements)." : "Clients must answer to book."}
          </span>
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">Ask for</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="appliesTo" value="all" checked={!some} onChange={() => setSome(false)} className="accent-lime-ink" />
            Every session
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="appliesTo" value="some" checked={some} onChange={() => setSome(true)} className="accent-lime-ink" />
            Only some sessions
          </label>
        </div>
        {some && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2 rounded-xl border-2 border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="sessionTypeIds"
                    value={s.id}
                    defaultChecked={defaultValues?.sessionTypeIds.includes(s.id)}
                    className="size-4 accent-lime-ink"
                  />
                  {s.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        {errors.sessions && <p className="mt-1.5 text-xs font-medium text-danger">{errors.sessions}</p>}
      </fieldset>

      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
        <Link
          href="/dashboard/bookings/setup#form"
          className="text-center text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
