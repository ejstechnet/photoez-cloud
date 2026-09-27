"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Field, FormError, SubmitButton } from "@/components/form";

// Asks for a reset link. The answer is the same whether or not the email has
// an account, so the form can't be used to find out who signed up.
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="rounded-2xl bg-lime/15 p-5 text-sm leading-relaxed">
        <p className="font-bold text-lime-ink">Check your email</p>
        <p className="mt-1">
          If <strong>{sentTo}</strong> has a PhotoEZ Cloud account, a link to choose a new password is on its way. It
          works for one hour. Don&apos;t see it? Check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <FormError message={error} />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}
