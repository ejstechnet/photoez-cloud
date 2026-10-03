"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { overLimit } from "@/lib/rate-limit";
import { toE164 } from "@/lib/sms/phone";
import { setConsent, textingOn } from "@/lib/sms/send";

export type SignupState = { message?: string; done?: boolean };

// The studio's text reminders sign-up page. Anyone can call this, so it's
// rate limited, and it only records a yes when the box was ticked.
export async function signUpForTexts(slug: string, _prev: SignupState, formData: FormData): Promise<SignupState> {
  if (String(formData.get("website") ?? "") !== "") return { message: "Something went wrong. Please try again." };
  if (await overLimit("sms-signup", 10, 60 * 60 * 1000)) return { message: "Too many tries from here. Please wait a little and try again." };
  const [studio] = await db.select({ id: photographers.id }).from(photographers).where(eq(photographers.studioSlug, slug.toLowerCase()));
  if (!studio || !(await textingOn(studio.id))) return { message: "Text reminders aren't available right now." };
  const phone = toE164(String(formData.get("phone") ?? ""));
  if (!phone) return { message: "Enter your mobile number, like (503) 555-1234." };
  if (formData.get("smsOptIn") !== "on") return { message: "Check the box to agree to text reminders." };
  const saved = await setConsent(studio.id, phone, "in", "form");
  if (!saved) return { message: "This number replied STOP before. To get texts again, reply START to any of our texts." };
  return { done: true };
}
