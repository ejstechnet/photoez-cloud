import { referrerByCode } from "@/lib/referrals";
import { SignUpForm } from "./signup-form";

// Sign-up, greeting visitors who came through a photographer's referral link.
export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { ref } = await searchParams;
  const referrer = typeof ref === "string" ? await referrerByCode(ref.toLowerCase()) : null;
  return <SignUpForm invitedBy={referrer?.name ?? null} />;
}
