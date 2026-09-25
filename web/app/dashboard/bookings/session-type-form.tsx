"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton } from "@/components/form";
import { RichTextField } from "@/components/rich-text-editor";
import { LOCATION_LABELS, SHOOT_LOCATIONS } from "@/lib/session-types";
import type { SessionTypeFormState } from "./actions";

export type SessionTypeValues = {
  name: string;
  shortDescription: string | null;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  salePriceCents: number | null;
  saleEndsOn: string | null;
  depositPercent: number;
  location: string | null;
  photosIncluded: number | null;
  hidden: boolean;
};

// Add/edit form for a bookable session. `action` is addSessionType, or
// updateSessionType bound to one session's id.
export function SessionTypeForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: SessionTypeFormState, formData: FormData) => Promise<SessionTypeFormState>;
  defaultValues?: SessionTypeValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};
  const dollars = (cents: number) => (cents / 100).toFixed(cents % 100 ? 2 : 0);
  const price = defaultValues ? dollars(defaultValues.priceCents) : "";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label="Session name"
        name="name"
        defaultValue={defaultValues?.name}
        error={errors.name}
        placeholder="Mini maternity session"
        required
      />
      <Field
        label="Short summary"
        name="shortDescription"
        defaultValue={defaultValues?.shortDescription ?? ""}
        error={errors.shortDescription}
        hint="One line shown under the name on your booking page. Optional."
      />
      <RichTextField
        label="Description"
        name="description"
        defaultValue={defaultValues?.description ?? ""}
        error={errors.description}
        hint="What's included, what to bring, outfit changes. Optional."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Length (minutes)"
          name="durationMinutes"
          type="number"
          inputMode="numeric"
          min={5}
          step={5}
          defaultValue={defaultValues?.durationMinutes ?? 60}
          error={errors.durationMinutes}
        />
        <Field
          label="Price ($)"
          name="price"
          inputMode="decimal"
          defaultValue={price}
          error={errors.price}
          placeholder="150"
        />
        <Field
          label="Deposit (%)"
          name="depositPercent"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          defaultValue={defaultValues?.depositPercent ?? 100}
          error={errors.depositPercent}
          hint="Collected online once payments arrive."
        />
      </div>
      <div className="grid gap-4 rounded-2xl border-2 border-dashed border-border p-4 sm:grid-cols-2">
        <Field
          label="Special price ($)"
          name="salePrice"
          inputMode="decimal"
          defaultValue={defaultValues?.salePriceCents != null ? dollars(defaultValues.salePriceCents) : ""}
          error={errors.salePrice}
          placeholder="Optional"
          hint="Shown with the regular price crossed out."
        />
        <Field
          label="Sale ends"
          name="saleEndsOn"
          type="date"
          defaultValue={defaultValues?.saleEndsOn ?? ""}
          error={errors.saleEndsOn}
          hint="Last day of the sale. Blank = until you remove it."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Where"
          name="location"
          defaultValue={defaultValues?.location ?? ""}
          error={errors.location}
        >
          <option value="">Not specified</option>
          {SHOOT_LOCATIONS.map((location) => (
            <option key={location} value={location}>
              {LOCATION_LABELS[location]}
            </option>
          ))}
        </SelectField>
        <Field
          label="Edited photos included"
          name="photosIncluded"
          inputMode="numeric"
          defaultValue={defaultValues?.photosIncluded ?? ""}
          error={errors.photosIncluded}
          hint="Optional"
        />
      </div>
      <label className="flex items-start gap-3 rounded-xl border-2 border-border px-3.5 py-3">
        <input
          type="checkbox"
          name="hidden"
          defaultChecked={defaultValues?.hidden ?? false}
          className="mt-1 size-4 accent-lime-ink"
        />
        <span>
          <span className="block text-sm font-semibold">Hide from my booking page</span>
          <span className="block text-xs text-muted">Keep it saved without clients being able to book it.</span>
        </span>
      </label>
      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
        <Link
          href="/dashboard/bookings/setup"
          className="text-center text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
