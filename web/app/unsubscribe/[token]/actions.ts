"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { studioFromUnsubscribeToken } from "@/lib/unsubscribe";

// The unsubscribe page's buttons: stop or restart the owner's emails to
// this studio. The signed link is the only thing that proves who it is.
export async function setUnsubscribed(token: string, unsubscribed: boolean) {
  const studioId = studioFromUnsubscribeToken(token);
  if (!studioId) return;
  await db
    .update(photographers)
    .set({ marketingOptOutAt: unsubscribed ? new Date() : null })
    .where(eq(photographers.id, studioId));
  revalidatePath(`/unsubscribe/${token}`);
}
