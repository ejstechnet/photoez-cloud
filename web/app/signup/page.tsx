import { referrerByCode } from "@/lib/referrals";
import { SignUpForm } from "./signup-form";

// Sign-up, greeting visitors who came through a photographer's referral link.
export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const { ref, email, src } = await searchParams;
  const referrer = typeof ref === "string" ? await referrerByCode(ref.toLowerCase()) : null;
  // Links can pass the address on (so they needn't retype it) and where the
  // visitor came from (the landing page's ?src=, saved after sign-up).
  return (
    <SignUpForm
      invitedBy={referrer?.name ?? null}
      defaultEmail={typeof email === "string" ? email.slice(0, 254) : ""}
      source={typeof src === "string" ? src : null}
    />
  );
}
