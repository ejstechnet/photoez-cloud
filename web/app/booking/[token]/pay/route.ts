import { redirect } from "next/navigation";
import { findClientBooking } from "@/lib/booking/client-booking";
import { startCheckout } from "@/lib/payments/checkout";

// "Pay balance" (or finishing a deposit while the time is still held) from
// the client's booking page: opens Stripe Checkout for what's owed next.
export async function GET(_request: Request, { params }: RouteContext<"/booking/[token]/pay">) {
  const { token } = await params;
  const found = await findClientBooking(token);
  if (!found) return new Response("Not found", { status: 404 });
  const { booking } = found;

  const holdOver = booking.status === "pending_payment" && (booking.holdExpiresAt?.getTime() ?? 0) < Date.now();
  if (booking.status === "cancelled" || booking.status === "completed" || holdOver) redirect(`/booking/${token}`);

  const url = await startCheckout(booking, found.name);
  redirect(url ?? `/booking/${token}`);
}
