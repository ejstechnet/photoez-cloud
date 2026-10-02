"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { calendarUrl } from "@/lib/calendar-link";

const newToken = () => randomBytes(24).toString("base64url");

// Makes the link the first time (and returns the existing one after that).
export async function makeCalendarLink(): Promise<string> {
  const user = await requirePhotographer();
  const [current] = await db.select({ token: photographers.calendarToken }).from(photographers).where(eq(photographers.id, user.id));
  if (current?.token) return calendarUrl(current.token);
  const token = newToken();
  await db.update(photographers).set({ calendarToken: token }).where(eq(photographers.id, user.id));
  revalidatePath("/dashboard/settings");
  return calendarUrl(token);
}

// A new link; the old one stops working (in case it was shared by mistake).
export async function resetCalendarLink(): Promise<string> {
  const user = await requirePhotographer();
  const token = newToken();
  await db.update(photographers).set({ calendarToken: token }).where(eq(photographers.id, user.id));
  revalidatePath("/dashboard/settings");
  return calendarUrl(token);
}
