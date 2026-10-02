"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthCard } from "@/components/auth-card";
import { Field, FormError, SubmitButton } from "@/components/form";
import { PasswordField } from "@/components/password-field";
import { REFERRAL_DISCOUNT_PERCENT, TRIAL_DAYS } from "@/lib/plans";
import { recordSignupSource } from "./actions";

// The sign-up form (page.tsx adds the referral greeting).
export function SignUpForm({
  invitedBy,
  defaultEmail = "",
  source = null,
}: {
  invitedBy: string | null;
  defaultEmail?: string;
  source?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // After sign-up: the address the confirmation email went to.
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const email = String(form.get("email"));
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      businessName: String(form.get("businessName")) || undefined,
      email,
      password: String(form.get("password")),
      // Where the confirmation link lands (signed in).
      callbackURL: "/dashboard",
    });

    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      setPending(false);
      return;
    }
    // Where they came from is kept for the campaign numbers; it never holds
    // anything up. Then they confirm their email before they're signed in.
    if (source) await recordSignupSource(source, email).catch(() => undefined);
    setSentTo(email);
    setPending(false);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email" subtitle="One last step to open your studio.">
        <div className="space-y-4">
          <p>
            We sent a confirmation link to <strong>{sentTo}</strong>. Click it to confirm your email and open your new
            studio.
          </p>
          <p className="text-sm text-muted">
            Don&rsquo;t see it? Check your spam or promotions folder. The link works for 24 hours; if it runs out,{" "}
            <Link href="/login" className="link">
              log in
            </Link>{" "}
            and we&rsquo;ll send a fresh one.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your studio"
      subtitle={
        <>
          Already have an account?{" "}
          <Link href="/login" className="link">
            Log in
          </Link>
        </>
      }
    >
      {invitedBy && (
        <p className="mb-5 rounded-xl bg-lime/20 px-4 py-3 text-sm font-semibold text-lime-ink">
          {invitedBy} invited you: start with a free {TRIAL_DAYS}-day Pro trial, then get {REFERRAL_DISCOUNT_PERCENT}% off
          your first plan payment.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Your name" name="name" autoComplete="name" required />
        <Field label="Business name" name="businessName" autoComplete="organization" hint="Optional" />
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          minLength={10}
          hint="At least 10 characters"
          required
        />
        <FormError message={error} />
        <SubmitButton pending={pending}>Create account</SubmitButton>
        <p className="text-center text-xs text-muted">
          By creating an account, you agree to the{" "}
          <Link href="/terms" className="link">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="link">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthCard>
  );
}
