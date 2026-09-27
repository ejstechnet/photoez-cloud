"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { FormError, SubmitButton } from "@/components/form";
import { PasswordField } from "@/components/password-field";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) {
      setError("The two passwords don't match.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (error) {
      setError(
        error.code === "INVALID_TOKEN"
          ? "This reset link has expired or was already used. Ask for a new one."
          : (error.message ?? "Something went wrong. Please try again."),
      );
      setPending(false);
      return;
    }
    router.push("/login?reset=1");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        minLength={10}
        hint="At least 10 characters."
        required
      />
      <PasswordField label="Type it again" name="confirm" autoComplete="new-password" minLength={10} required />
      <FormError message={error} />
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
