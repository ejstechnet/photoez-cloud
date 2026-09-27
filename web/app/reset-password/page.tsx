import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password · PhotoEZ Cloud" };

// The link in the reset email lands here with ?token=…, or ?error=INVALID_TOKEN
// when the link is used up or more than an hour old.
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && token.length > 0 && !error;

  return (
    <AuthCard
      title="Choose a new password"
      subtitle={
        <>
          Back to{" "}
          <Link href="/login" className="link">
            Log in
          </Link>
        </>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-4 text-sm">
          <p className="rounded-xl border-2 border-danger/30 bg-danger/10 px-3.5 py-2.5 font-medium text-danger">
            This reset link has expired or was already used.
          </p>
          <Link href="/forgot-password" className="btn-primary w-full">
            Send a new link
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
