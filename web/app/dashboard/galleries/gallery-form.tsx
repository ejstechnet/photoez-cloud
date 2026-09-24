"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton } from "@/components/form";
import type { GalleryFormState } from "./actions";

// Create/edit form for a gallery: title plus an optional client.
export function GalleryForm({
  action,
  clients,
  defaultValues,
  submitLabel,
  cancelHref,
}: {
  action: (state: GalleryFormState, formData: FormData) => Promise<GalleryFormState>;
  clients: { id: string; name: string }[];
  defaultValues?: { title: string; clientId: string | null; freeLimit: number };
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label="Gallery title"
        name="title"
        placeholder="Nguyen family, fall mini session"
        defaultValue={defaultValues?.title}
        error={errors.title}
        required
      />
      <SelectField
        label="Client"
        name="clientId"
        defaultValue={defaultValues?.clientId ?? ""}
        error={errors.clientId}
        hint={clients.length === 0 ? "Add clients on the Clients page to link them here." : "Optional"}
      >
        <option value="">No client yet</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </SelectField>
      <Field
        label="Free picks"
        name="freeLimit"
        type="number"
        min={0}
        inputMode="numeric"
        defaultValue={defaultValues?.freeLimit ?? 10}
        error={errors.freeLimit}
        hint="How many photos the client can choose for free, like “Choose up to 10 photos.”"
      />
      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
        <Link
          href={cancelHref}
          className="text-center text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
