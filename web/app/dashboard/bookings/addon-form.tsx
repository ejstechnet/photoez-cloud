"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SubmitButton, TextAreaField } from "@/components/form";
import type { AddonFormState } from "./addon-actions";

export type AddonValues = { name: string; description: string | null; priceCents: number; maxQuantity: number };

// Add/edit form for a booking add-on. `action` is addAddon, or updateAddon
// bound to one add-on's id.
export function AddonForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: AddonFormState, formData: FormData) => Promise<AddonFormState>;
  defaultValues?: AddonValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};
  const price = defaultValues ? (defaultValues.priceCents / 100).toFixed(defaultValues.priceCents % 100 ? 2 : 0) : "";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label="Name"
        name="name"
        defaultValue={defaultValues?.name}
        error={errors.name}
        placeholder="Additional edited photos"
        required
      />
      <TextAreaField
        label="Description"
        name="description"
        rows={2}
        defaultValue={defaultValues?.description ?? ""}
        error={errors.description}
        hint="One or two lines shown on the add-on card. Optional."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Price for each ($)"
          name="price"
          inputMode="decimal"
          defaultValue={price}
          error={errors.price}
          placeholder="10"
        />
        <Field
          label="Most a client can add"
          name="maxQuantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          defaultValue={defaultValues?.maxQuantity ?? 10}
          error={errors.maxQuantity}
        />
      </div>
      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
        <Link
          href="/dashboard/bookings/setup#addons"
          className="text-center text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
