"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton } from "@/components/form";
import { formatPrice } from "@/lib/booking/format";
import type { GalleryFormState } from "./actions";

// Create/edit form for a gallery: title plus an optional client.
export function GalleryForm({
  action,
  clients,
  sessions,
  defaultValues,
  submitLabel,
  cancelHref,
  extras,
}: {
  action: (state: GalleryFormState, formData: FormData) => Promise<GalleryFormState>;
  clients: { id: string; name: string }[];
  // The studio's session types, for "What kind of shoot is this?".
  sessions: { id: string; name: string }[];
  defaultValues?: {
    title: string;
    sessionTypeId?: string | null;
    clientId: string | null;
    freeLimit: number;
    extraPhotoPriceCents?: number | null;
    notesEnabled?: boolean | null;
  };
  submitLabel: string;
  cancelHref: string;
  // Set when the photographer's plan includes selling extra photos.
  extras?: { studioPriceCents: number } | null;
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
      {sessions.length > 0 && (
        <SelectField
          label="Session type"
          name="sessionTypeId"
          defaultValue={defaultValues?.sessionTypeId ?? ""}
          error={errors.sessionTypeId}
          hint="Decides which store products show in this gallery (e.g. senior items for senior sessions)."
        >
          <option value="">Not set (every product that isn&rsquo;t limited)</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      )}
      <Field
        label="Free picks"
        name="freeLimit"
        type="number"
        min={0}
        inputMode="numeric"
        defaultValue={defaultValues?.freeLimit ?? 10}
        error={errors.freeLimit}
        hint="How many photos the client can choose, like “Choose up to 10 photos.” Use 0 for no limit."
      />
      {extras && (
        <Field
          label="Price per extra photo ($)"
          name="extraPhotoPrice"
          inputMode="decimal"
          defaultValue={
            defaultValues?.extraPhotoPriceCents != null ? (defaultValues.extraPhotoPriceCents / 100).toFixed(2) : ""
          }
          placeholder={(extras.studioPriceCents / 100).toFixed(2)}
          error={errors.extraPhotoPrice}
          hint={`Clients can pick more than their free picks for this much each. Blank uses your studio price (${formatPrice(extras.studioPriceCents)}); 0 turns extras off for this gallery.`}
        />
      )}
      <SelectField
        label="Client notes on picks"
        name="notes"
        defaultValue={defaultValues?.notesEnabled == null ? "default" : defaultValues.notesEnabled ? "on" : "off"}
        hint="Clients can add a note (like an editing request) to each photo they pick."
      >
        <option value="default">Use my studio setting</option>
        <option value="on">On for this gallery</option>
        <option value="off">Off for this gallery</option>
      </SelectField>
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
