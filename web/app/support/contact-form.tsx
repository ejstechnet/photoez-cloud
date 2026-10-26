"use client";

import { startTransition, useActionState, useState } from "react";
import { Field, FormError, SelectField, SubmitButton, TextAreaField } from "@/components/form";
import { SUPPORT_TOPICS, type SupportRole } from "@/lib/support";
import { sendSupportMessage, type SupportFormState } from "./actions";

const ROLE_CHOICES: { role: SupportRole; title: string; detail: string }[] = [
  { role: "photographer", title: "I'm a photographer", detail: "I run my studio on PhotoEZ Cloud" },
  { role: "client", title: "I'm a client", detail: "My photographer sent me a gallery, booking, or invoice" },
];

// The Support page's contact form. A logged-in photographer starts with
// their name, email, and studio filled in.
export function ContactForm({
  initialRole,
  account,
}: {
  initialRole: SupportRole;
  account: { name: string; email: string; studio: string } | null;
}) {
  const [state, formAction, pending] = useActionState<SupportFormState, FormData>(sendSupportMessage, {});
  const [role, setRole] = useState<SupportRole>(initialRole);
  const [startedAt] = useState(() => Date.now());
  const errors = state.errors ?? {};
  // Only a photographer's own details are filled in for them.
  const prefill = role === "photographer" ? account : null;

  if (state.sent) {
    return (
      <div className="py-6 text-center" role="status">
        <p className="font-display text-3xl font-bold">Thank you!</p>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          Your message is on its way. We read every one and reply by email, usually within one business day.
        </p>
      </div>
    );
  }

  return (
    // Sent by hand rather than with action={…}, which clears the form after
    // every try and would lose a long message over one mistyped field.
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-5"
      noValidate
    >
      {/* Hidden from people; spam bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="startedAt" value={startedAt} />

      <fieldset>
        <legend className="text-sm font-semibold">Who are you?</legend>
        <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
          {ROLE_CHOICES.map((choice) => (
            <label
              key={choice.role}
              className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition ${
                role === choice.role ? "border-lime-ink bg-lime/10" : "border-border hover:border-brand"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={choice.role}
                checked={role === choice.role}
                onChange={() => setRole(choice.role)}
                className="mt-1 accent-lime-ink"
              />
              <span>
                <span className="block font-bold">{choice.title}</span>
                <span className="block text-sm text-muted">{choice.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {role === "client" && (
        <p className="rounded-2xl bg-sky-light/40 p-4 text-sm leading-relaxed">
          <strong>Questions about your session, prices, edits, or refunds?</strong> Your photographer sets those and can
          answer fastest: reply to any email they sent you. Use this form when something on the site isn&rsquo;t working,
          like a gallery that won&rsquo;t load or a payment button that fails.
        </p>
      )}

      {/* Keyed by role so switching resets the prefilled fields and the topic. */}
      <div key={role} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="name" autoComplete="name" defaultValue={prefill?.name} error={errors.name} required />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={prefill?.email}
            error={errors.email}
            hint="We'll reply here."
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="What's this about?"
            name="topic"
            defaultValue={SUPPORT_TOPICS[role][0].value}
            error={errors.topic}
          >
            {SUPPORT_TOPICS[role].map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <Field
            label={role === "client" ? "Your photographer's studio" : "Your studio name"}
            name="studio"
            defaultValue={prefill?.studio}
            error={errors.studio}
            hint="Optional"
          />
        </div>
        <Field
          label="Link to the page"
          name="pageUrl"
          type="url"
          placeholder="https://photoezcloud.com/…"
          error={errors.pageUrl}
          hint="Optional. Paste the address of the page where it happened."
        />
        <TextAreaField
          label="How can we help?"
          name="message"
          rows={6}
          error={errors.message}
          placeholder="What were you trying to do, and what happened instead? Any error message helps."
          required
        />
      </div>
      <FormError message={state.message} />
      <SubmitButton pending={pending}>Send message</SubmitButton>
    </form>
  );
}
