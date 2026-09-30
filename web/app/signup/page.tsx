import { referrerByCode } from "@/lib/referrals";
import { SignUpForm } from "./signup-form";

// Sign-up, greeting visitors who came through a photographer's referral link.
export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { ref, email } = await searchParams;
  const referrer = typeof ref === "string" ? await referrerByCode(ref.toLowerCase()) : null;
  // The landing page (/join) passes the address on, so they needn't retype it.
  return <SignUpForm invitedBy={referrer?.name ?? null} defaultEmail={typeof email === "string" ? email.slice(0, 254) : ""} />;
}
