import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { photographers, smsConsents, smsLog } from "@/db/schema";
import { effectivePlan, hasFeature } from "@/lib/plans";
import { openSecret } from "@/lib/secret-box";
import { settingsWithDefaults, testText, type SmsKind } from "./messages";
import { siteUrl } from "@/lib/site";
import { toE164 } from "./phone";

// Sends texts through each studio's OWN Twilio account (Settings > Text
// messages), so studios pay for their own texts. A client is only texted when
// the studio's plan has texting, that kind of text is on, and the client
// agreed (sms_consents). Every try is written to sms_log. Texts never hold up
// or break the email that goes with them: failures are logged, not thrown.

export type TwilioAccount = { sid: string; token: string; from: string };

export async function smsSetup(photographerId: string) {
  const [studio] = await db
    .select({
      plan: photographers.plan,
      trialEndsAt: photographers.trialEndsAt,
      sid: photographers.twilioAccountSid,
      sealedToken: photographers.twilioAuthToken,
      from: photographers.smsFrom,
      texts: photographers.smsTexts,
      alertPhone: photographers.smsAlertPhone,
      name: photographers.name,
      businessName: photographers.businessName,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio) return null;
  const token = studio.sealedToken ? openSecret(studio.sealedToken) : null;
  const account: TwilioAccount | null = studio.sid && token && studio.from ? { sid: studio.sid, token, from: studio.from } : null;
  return {
    allowed: hasFeature(effectivePlan(studio.plan, studio.trialEndsAt), "textMessages"),
    account,
    settings: settingsWithDefaults(studio.texts),
    alertPhone: studio.alertPhone,
    studioName: studio.businessName || studio.name,
  };
}

// Whether this studio is texting at all (for showing the booking form's checkbox).
export async function textingOn(photographerId: string) {
  const setup = await smsSetup(photographerId);
  return Boolean(setup?.allowed && setup.account);
}

// One text through Twilio's API. The code is Twilio's error code, if any.
export async function sendTwilio(
  account: TwilioAccount,
  to: string,
  body: string,
  statusCallback?: string,
): Promise<{ sid: string } | { error: string; code: number | null }> {
  const form = new URLSearchParams({ To: to, Body: body });
  // Twilio reports back whether it was delivered (app/api/twilio/status).
  if (statusCallback?.startsWith("https://")) form.set("StatusCallback", statusCallback);
  // A Messaging Service (MG…) picks the number itself; otherwise send from the number.
  if (account.from.startsWith("MG")) form.set("MessagingServiceSid", account.from);
  else form.set("From", account.from);
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account.sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${account.sid}:${account.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (response.ok && data.sid) return { sid: data.sid };
    if (response.status === 401) return { error: "Twilio didn't accept the Account SID and Auth Token.", code: data.code ?? null };
    return { error: data.message ?? `Twilio said ${response.status}.`, code: data.code ?? null };
  } catch {
    return { error: "Couldn't reach Twilio. Try again in a minute.", code: null };
  }
}

async function log(photographerId: string, kind: string, to: string, body: string, result: { status: "sent" | "failed" | "skipped"; error?: string | null; sid?: string | null }) {
  try {
    await db.insert(smsLog).values({ photographerId, kind, toPhone: to, body, status: result.status, error: result.error ?? null, twilioSid: result.sid ?? null });
  } catch (error) {
    console.error("Couldn't write the text log", error);
  }
}

// Sends and logs. Twilio's 21610 means the person replied STOP at Twilio's end.
async function deliver(photographerId: string, account: TwilioAccount, kind: string, to: string, body: string) {
  const result = await sendTwilio(account, to, body, `${siteUrl}/api/twilio/status/${photographerId}`);
  if ("sid" in result) {
    await log(photographerId, kind, to, body, { status: "sent", sid: result.sid });
    return true;
  }
  if (result.code === 21610) await setConsent(photographerId, to, "out", "reply");
  await log(photographerId, kind, to, body, { status: "failed", error: result.error });
  return false;
}

export async function consentFor(photographerId: string, phone: string) {
  const [row] = await db
    .select({ status: smsConsents.status, source: smsConsents.source, updatedAt: smsConsents.updatedAt })
    .from(smsConsents)
    .where(and(eq(smsConsents.photographerId, photographerId), eq(smsConsents.phone, phone)));
  return row ?? null;
}

// Records a yes or a no. Someone who replied STOP stays opted out until they
// reply START themselves: a booking checkbox or the studio can't override it.
export async function setConsent(photographerId: string, phone: string, status: "in" | "out", source: "booking" | "form" | "studio" | "reply") {
  const e164 = toE164(phone);
  if (!e164) return false;
  if (status === "in" && source !== "reply") {
    const current = await consentFor(photographerId, e164);
    if (current?.status === "out" && current.source === "reply") return false;
  }
  await db
    .insert(smsConsents)
    .values({ photographerId, phone: e164, status, source })
    .onConflictDoUpdate({
      target: [smsConsents.photographerId, smsConsents.phone],
      set: { status, source, updatedAt: sql`now()` },
    });
  return true;
}

// A text to a client: only when it's on, the account is set up, and they agreed.
export async function textClient(photographerId: string, kind: SmsKind, logKind: string, phone: string | null | undefined, body: (studioName: string) => string) {
  try {
    const to = toE164(phone);
    if (!to) return false;
    const setup = await smsSetup(photographerId);
    if (!setup?.allowed || !setup.account || !setup.settings[kind]) return false;
    if ((await consentFor(photographerId, to))?.status !== "in") return false;
    return await deliver(photographerId, setup.account, logKind, to, body(setup.studioName));
  } catch (error) {
    console.error(`Text "${logKind}" failed`, error);
    return false;
  }
}

// A text to the studio's own phone (new bookings and inquiries).
export async function textStudio(photographerId: string, logKind: string, body: string) {
  try {
    const setup = await smsSetup(photographerId);
    const to = toE164(setup?.alertPhone);
    if (!setup?.allowed || !setup.account || !setup.settings.studioAlerts || !to) return false;
    return await deliver(photographerId, setup.account, logKind, to, body);
  } catch (error) {
    console.error(`Text "${logKind}" failed`, error);
    return false;
  }
}

// Checks a Account SID + Auth Token pair with Twilio before saving it.
export async function verifyTwilio(sid: string, token: string): Promise<{ ok: true } | { error: string }> {
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 404) return { error: "Twilio didn't accept that Account SID and Auth Token. Copy both again from your Twilio Console." };
    return { error: `Twilio answered ${response.status}. Try again in a minute.` };
  } catch {
    return { error: "Couldn't reach Twilio. Try again in a minute." };
  }
}

// Settings' "Send a test text" (always to the number given, no consent needed:
// it's the studio's own phone).
export async function sendTestText(photographerId: string, phone: string) {
  const setup = await smsSetup(photographerId);
  if (!setup?.account) return { error: "Save your Twilio details first." };
  const to = toE164(phone);
  if (!to) return { error: "Enter a full phone number, like (503) 555-1234." };
  const ok = await deliver(photographerId, setup.account, "test", to, testText(setup.studioName));
  return ok ? { ok: true as const } : { error: "Twilio didn't send it. The reason is in the Text log." };
}
