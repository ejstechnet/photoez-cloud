"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { issueGiftCard, type IssueState } from "./actions";

// Issue a free gift card (a giveaway, a thank-you, a raffle prize).
export function IssueForm() {
  const [state, formAction, pending] = useActionState<IssueState, FormData>(issueGiftCard, {});
  const errors = state.errors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <Field label="Amount ($)" name="amount" inputMode="numeric" placeholder="100" error={errors.amount} required />
        <Field label="Their name" name="recipientName" error={errors.recipientName} required />
      </div>
      <Field
        label="Their email (optional)"
        name="recipientEmail"
        type="email"
        error={errors.recipientEmail}
        hint="We'll email them the card. Leave blank to share the code yourself."
      />
      <Field label="Message (optional)" name="message" maxLength={500} placeholder="Congratulations, you won!" />
      <FormError message={state.message} />
      {state.saved && !pending && <p className="rounded-xl bg-lime/15 px-4 py-2.5 text-sm font-semibold text-lime-ink">✓ {state.saved}</p>}
      <SubmitButton pending={pending} fullWidth={false}>
        Issue gift card
      </SubmitButton>
    </form>
  );
}
