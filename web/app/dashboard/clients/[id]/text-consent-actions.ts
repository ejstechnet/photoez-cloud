"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { setConsent } from "@/lib/sms/send";
import { requirePhotographer } from "@/lib/session";

// The studio marks a client as agreeing to texts (they said so in person or
// by email), or stops texting them. A client who replied STOP can only opt
// back in themselves by replying START.
export async function setClientTexts(clientId: string, on: boolean): Promise<{ message?: string }> {
  const user = await requirePhotographer();
  const [client] = await db
    .select({ phone: clients.phone })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.photographerId, user.id)));
  if (!client?.phone) return { message: "Add the client's phone number first." };
  const done = await setConsent(user.id, client.phone, on ? "in" : "out", "studio");
  revalidatePath(`/dashboard/clients/${clientId}`);
  if (!done) return { message: on ? "They replied STOP, so only they can turn texts back on (by replying START)." : "That phone number doesn't look complete." };
  return {};
}
