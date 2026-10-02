import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";
import { GoogleButton } from "@/components/google-button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reset, google } = await searchParams;
  // Only allow redirects within this site, so a crafted link can't send
  // someone to another website after they log in.
  const redirectTo =
    // (Backslashes too: some browsers read "/\example.com" as "//example.com".)
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/dashboard";

  return (
    <AuthCard
      title="Welcome back"
      subtitle={
        <>
          New here?{" "}
          <Link href="/signup" className="link">
            Create an account
          </Link>
        </>
      }
    >
      {reset === "1" && (
        <p role="status" className="mb-4 rounded-xl bg-lime/15 px-3.5 py-2.5 text-sm font-semibold text-lime-ink">
          Your password was changed. Log in with your new password.
        </p>
      )}
      {google === "failed" && (
        <p role="alert" className="mb-4 rounded-xl bg-coral/15 px-3.5 py-2.5 text-sm font-semibold text-coral">
          Google sign-in didn&rsquo;t finish. Please try again, or log in with your email.
        </p>
      )}
      {process.env.GOOGLE_CLIENT_ID && <GoogleButton callbackURL={redirectTo} />}
      <LoginForm redirectTo={redirectTo} />
    </AuthCard>
  );
}
