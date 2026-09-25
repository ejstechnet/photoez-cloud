"use client";

import { useActionState, useState } from "react";
import { Field, FormError, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { submitInquiry, type InquiryFormState } from "./actions";

export function InquiryForm({
  slug,
  studioName,
  sessions,
}: {
  slug: string;
  studioName: string;
  sessions: { type: string; label: string; quote: boolean }[];
}) {
  const [state, formAction, pending] = useActionState<InquiryFormState, FormData>(
    submitInquiry.bind(null, slug),
    {},
  );
  const [sessionType, setSessionType] = useState(sessions[0]?.type ?? "other");
  const [startedAt] = useState(() => Date.now());
  const errors = state.errors ?? {};
  const quote = sessions.find((s) => s.type === sessionType)?.quote ?? false;

  if (state.sent) {
    return (
      <div className="py-6 text-center">
        <p className="font-display text-3xl font-bold">Thank you!</p>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          {state.sent.quote
            ? `Your quote request is on its way to ${studioName}. You'll hear back with details soon.`
            : `Your message is on its way to ${studioName}. You'll hear back soon.`}
        </p>
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
      <input type="hidden" name="startedAt" value={startedAt} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" autoComplete="name" error={errors.name} required />
        <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="What are you looking for?"
          name="sessionType"
          value={sessionType}
          onChange={(event) => setSessionType(event.target.value)}
          error={errors.sessionType}
        >
          {sessions.map((session) => (
            <option key={session.type} value={session.type}>
              {session.label}
              {session.quote ? " (quote)" : ""}
            </option>
          ))}
          <option value="other">Something else</option>
        </SelectField>
        <Field
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          error={errors.phone}
          hint="Optional"
        />
      </div>
      <Field
        label="Preferred date"
        name="preferredDate"
        placeholder="A date, a month, or “flexible”"
        error={errors.preferredDate}
        hint="Optional"
      />
      <TextAreaField
        label={quote ? "Tell us about your project" : "Tell us about your session"}
        name="message"
        rows={5}
        error={errors.message}
        placeholder={
          quote
            ? "What's the occasion, how many people, where, and anything else we should know?"
            : "Who's in the photos, any ideas you have, questions…"
        }
        required
      />
      <FormError message={state.message} />
      <SubmitButton pending={pending}>{quote ? "Request a quote" : "Send inquiry"}</SubmitButton>
    </form>
  );
}
