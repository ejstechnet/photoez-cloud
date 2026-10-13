"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";

// The welcome checklist's two remembered choices (lib/setup-checklist.ts).

// "Copy link": ticks off "Share your studio link".
export async function markStudioLinkCopied() {
  const user = await requirePhotographer();
  await db.update(photographers).set({ setupLinkCopiedAt: new Date() }).where(eq(photographers.id, user.id));
  revalidatePath("/dashboard");
}

// "Hide this": the card stays away for good.
export async function dismissSetupChecklist() {
  const user = await requirePhotographer();
  await db.update(photographers).set({ setupDismissedAt: new Date() }).where(eq(photographers.id, user.id));
  revalidatePath("/dashboard");
}
