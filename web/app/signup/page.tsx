"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AuthCard } from "@/components/auth-card";
import { Field, FormError, SubmitButton } from "@/components/form";
import { PasswordField } from "@/components/password-field";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      businessName: String(form.get("businessName")) || undefined,
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (error) {
      setError(error.message ?? "Something went wrong. Please try again.");
      setPending(false);
      return;
    }
    // Sign-up also logs the photographer in.
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard
      title="Create your studio"
      subtitle={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Your name" name="name" autoComplete="name" required />
        <Field label="Business name" name="businessName" autoComplete="organization" hint="Optional" />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
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
      </form>
    </AuthCard>
  );
}
