"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SubmitButton, TextAreaField } from "@/components/form";
import type { ClientFormState } from "./actions";

type ClientValues = {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

// Add/edit form for a client. `action` is addClient, or updateClient bound
// to one client's id.
export function ClientForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  defaultValues?: ClientValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field label="Name" name="name" defaultValue={defaultValues?.name} error={errors.name} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
          error={errors.email}
          hint="Optional"
        />
        <Field
          label="Phone"
          name="phone"
          type="tel"
          defaultValue={defaultValues?.phone ?? ""}
          error={errors.phone}
          hint="Optional"
        />
      </div>
      <TextAreaField
        label="Notes"
        name="notes"
        rows={4}
        defaultValue={defaultValues?.notes ?? ""}
        error={errors.notes}
        hint="Session details, preferences, anything worth remembering."
      />
      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
        <Link
          href="/dashboard/clients"
          className="text-center text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
