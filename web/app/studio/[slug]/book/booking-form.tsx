"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SubmitButton, TextAreaField } from "@/components/form";
import { createBooking, type BookingFormState } from "./actions";

// The last step: the client's details. The session and time are bound in
// from the page, and the server re-checks both before saving.
export function BookingForm({
  slug,
  sessionTypeId,
  startsAt,
  backHref,
}: {
  slug: string;
  sessionTypeId: string;
  startsAt: string;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    createBooking.bind(null, slug, sessionTypeId, startsAt),
    {},
  );
  const errors = state.errors ?? {};

  if (state.taken) {
    return (
      <div className="rounded-2xl bg-sun/30 px-5 py-4">
        <p className="font-semibold">Sorry, that time was just booked.</p>
        <Link href={backHref} className="link mt-1 inline-block font-semibold">
          Pick another time
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {/* Hidden from people; spam bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" autoComplete="name" error={errors.name} required />
        <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} required />
      </div>
      <Field label="Phone" name="phone" type="tel" autoComplete="tel" error={errors.phone} hint="Optional" />
      <TextAreaField
        label="Anything we should know?"
        name="notes"
        rows={3}
        error={errors.notes}
        placeholder="Who's in the photos, ideas, questions…"
        hint="Optional"
      />
      <FormError message={state.message} />
      <SubmitButton pending={pending}>Confirm booking</SubmitButton>
    </form>
  );
}
