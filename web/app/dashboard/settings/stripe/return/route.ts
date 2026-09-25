import { redirect } from "next/navigation";
import { refreshStripeStatus } from "../../stripe-actions";

// Stripe sends the photographer back here after its sign-up screens.
export async function GET() {
  await refreshStripeStatus();
  redirect("/dashboard/settings#payments");
}
