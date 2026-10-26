"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { supportMessages } from "@/db/schema";
import { requireOwner } from "@/lib/owner";

// Marks a Support page message handled, or back to new.
export async function setSupportStatus(id: string, status: "new" | "done") {
  await requireOwner();
  await db.update(supportMessages).set({ status }).where(eq(supportMessages.id, id));
  revalidatePath("/dashboard/support");
}
