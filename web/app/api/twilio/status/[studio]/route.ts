import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { smsLog } from "@/db/schema";
import { deliveryError } from "@/lib/sms/messages";
import { setConsent, smsSetup } from "@/lib/sms/send";
import { validTwilioSignature } from "@/lib/sms/signature";
import { siteUrl } from "@/lib/site";

// Twilio reports what happened to each text after it accepted it. Delivered
// texts stay "Sent"; undelivered or failed ones show as failed in the Text
// log with the reason (like an unregistered number). Only requests signed
// with the studio's own auth token are accepted.
export async function POST(request: Request, { params }: RouteContext<"/api/twilio/status/[studio]">) {
  const { studio } = await params;
  if (!z.uuid().safeParse(studio).success) return new Response("Not found", { status: 404 });
  const setup = await smsSetup(studio);
  if (!setup?.account) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") fields[key] = value;
  const url = `${siteUrl}/api/twilio/status/${studio}`;
  if (!validTwilioSignature(setup.account.token, url, fields, request.headers.get("x-twilio-signature") ?? "")) {
    return new Response("Bad signature", { status: 403 });
  }

  if ((fields.MessageStatus === "undelivered" || fields.MessageStatus === "failed") && fields.MessageSid) {
    const code = Number(fields.ErrorCode) || null;
    const [row] = await db
      .update(smsLog)
      .set({ status: "failed", error: deliveryError(code) })
      .where(and(eq(smsLog.photographerId, studio), eq(smsLog.twilioSid, fields.MessageSid)))
      .returning({ to: smsLog.toPhone });
    // 21610: they replied STOP at Twilio's end.
    if (row && code === 21610) await setConsent(studio, row.to, "out", "reply");
  }
  return new Response(null, { status: 204 });
}
