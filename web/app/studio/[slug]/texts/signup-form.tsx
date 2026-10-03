"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { SmsConsent } from "@/components/sms-consent";
import { signUpForTexts, type SignupState } from "./actions";

export function TextSignupForm({ slug, studioName }: { slug: string; studioName: string }) {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signUpForTexts.bind(null, slug), {});
  if (state.done) {
    return (
      <p className="rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
        You&apos;re signed up for text reminders from {studioName}. Reply STOP to any text to opt out.
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-5">
      <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" placeholder="(503) 555-1234" required />
      <SmsConsent slug={slug} studioName={studioName} required />
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <FormError message={state.message} />
      <SubmitButton pending={pending} fullWidth={false}>
        Sign up for text reminders
      </SubmitButton>
    </form>
  );
}
