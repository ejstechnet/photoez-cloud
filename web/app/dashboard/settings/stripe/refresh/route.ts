import { connectStripe } from "../../stripe-actions";

// Stripe's sign-up link expired (or was reloaded): start a fresh one.
export async function GET() {
  await connectStripe();
}
