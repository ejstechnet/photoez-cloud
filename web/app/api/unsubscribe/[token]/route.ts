import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { studioFromUnsubscribeToken } from "@/lib/unsubscribe";

// One-click unsubscribe (RFC 8058): Gmail, Apple Mail and others POST here
// when someone uses their own Unsubscribe button on the owner's emails to
// studios. The link in the email itself opens /unsubscribe/<token> instead.
export async function POST(_request: Request, { params }: RouteContext<"/api/unsubscribe/[token]">) {
  const studioId = studioFromUnsubscribeToken((await params).token);
  if (!studioId) return new Response("Not found", { status: 404 });
  await db.update(photographers).set({ marketingOptOutAt: new Date() }).where(eq(photographers.id, studioId));
  return new Response("Unsubscribed", { status: 200 });
}
