import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { syncCheckoutSession } from "@/lib/billing";
import { requirePhotographer } from "@/lib/session";

// Back from Stripe Checkout: applies the new plan right away (the webhook
// does the same, whichever comes first), then shows Billing.
export async function GET(request: NextRequest) {
  const photographer = await requirePhotographer();
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const ok = sessionId ? await syncCheckoutSession(photographer.id, sessionId).catch(() => false) : false;
  redirect(ok ? "/dashboard/billing?welcome=1" : "/dashboard/billing");
}
