"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { effectivePlan, hasFeature } from "@/lib/plans";
import { sealSecret } from "@/lib/secret-box";
import { SMS_LABELS, type SmsKind, type SmsSettings } from "@/lib/sms/messages";
import { toE164 } from "@/lib/sms/phone";
import { sendTestText, verifyTwilio } from "@/lib/sms/send";
import { requirePhotographer } from "@/lib/session";

// Settings > Text messages: the studio's own Twilio account, which texts go
// out, and a test text. The auth token is checked with Twilio, then sealed;
// it's never sent back to the page.

export type TextsState = { message?: string; saved?: string };

async function allowed(photographerId: string) {
  const [studio] = await db
    .select({ plan: photographers.plan, trialEndsAt: photographers.trialEndsAt, hasToken: photographers.twilioAuthToken })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  return { ok: hasFeature(effectivePlan(studio.plan, studio.trialEndsAt), "textMessages"), hasToken: Boolean(studio.hasToken) };
}

export async function saveTextSettings(_prev: TextsState, formData: FormData): Promise<TextsState> {
  const user = await requirePhotographer();
  const plan = await allowed(user.id);
  if (!plan.ok) return { message: "Text messages are on the Pro and Studio plans." };

  const sid = String(formData.get("sid") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const fromInput = String(formData.get("from") ?? "").trim();
  const alertInput = String(formData.get("alertPhone") ?? "").trim();

  if (!/^AC[0-9a-fA-F]{32}$/.test(sid)) return { message: "The Account SID starts with AC and is 34 characters. Copy it from your Twilio Console." };
  if (token && !/^[0-9a-fA-F]{32}$/.test(token)) return { message: "The Auth Token is 32 letters and numbers. Copy it from your Twilio Console." };
  if (!token && !plan.hasToken) return { message: "Add your Auth Token." };
  const from = /^MG[0-9a-fA-F]{32}$/.test(fromInput) ? fromInput : toE164(fromInput);
  if (!from) return { message: "Enter your Twilio phone number, like (503) 555-1234, or a Messaging Service SID (MG…)." };
  const alertPhone = alertInput ? toE164(alertInput) : null;
  if (alertInput && !alertPhone) return { message: "Enter your cell number for alerts, like (503) 555-1234." };

  const legalName = String(formData.get("legalName") ?? "").trim().slice(0, 150) || null;
  const legalState = String(formData.get("legalState") ?? "").trim().toUpperCase();
  if (legalState && !/^[A-Z]{2}$/.test(legalState)) return { message: "Use the 2-letter state for your business, like OR." };

  const texts = Object.fromEntries((Object.keys(SMS_LABELS) as SmsKind[]).map((k) => [k, formData.get(k) === "on"])) as SmsSettings;

  // A new token (or a new account) is checked with Twilio before it's saved.
  const update: Partial<typeof photographers.$inferInsert> = {
    twilioAccountSid: sid,
    smsFrom: from,
    smsAlertPhone: alertPhone,
    smsTexts: texts,
    legalName,
    legalState: legalState || null,
  };
  if (token) {
    const check = await verifyTwilio(sid, token);
    if ("error" in check) return { message: check.error };
    update.twilioAuthToken = sealSecret(token);
  }
  await db.update(photographers).set(update).where(eq(photographers.id, user.id));
  revalidatePath("/dashboard/settings");
  return { saved: token ? "Saved. Twilio accepted your details." : "Saved." };
}

export async function sendTestTextAction(phone: string): Promise<{ ok?: boolean; message?: string }> {
  const user = await requirePhotographer();
  if (!(await allowed(user.id)).ok) return { message: "Text messages are on the Pro and Studio plans." };
  const result = await sendTestText(user.id, phone);
  return "ok" in result ? { ok: true } : { message: result.error };
}

// Stops all texting and forgets the Twilio details.
export async function disconnectTwilio(): Promise<void> {
  const user = await requirePhotographer();
  await db
    .update(photographers)
    .set({ twilioAccountSid: null, twilioAuthToken: null, smsFrom: null })
    .where(eq(photographers.id, user.id));
  revalidatePath("/dashboard/settings");
}
