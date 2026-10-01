import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reset } = await searchParams;
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
      <LoginForm redirectTo={redirectTo} />
    </AuthCard>
  );
}
