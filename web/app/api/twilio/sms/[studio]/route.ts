import { z } from "zod";
import { replyKeyword } from "@/lib/sms/messages";
import { setConsent, smsSetup } from "@/lib/sms/send";
import { validTwilioSignature } from "@/lib/sms/signature";
import { siteUrl } from "@/lib/site";

// Twilio calls this when someone texts the studio's number (the studio pastes
// this address into its Twilio number's "A message comes in" setting; it's
// shown in Settings > Text messages). STOP-type replies opt the number out,
// START opts it back in. Twilio itself sends the standard confirmation reply.
// Only requests signed with the studio's own auth token are accepted.
export async function POST(request: Request, { params }: RouteContext<"/api/twilio/sms/[studio]">) {
  const { studio } = await params;
  if (!z.uuid().safeParse(studio).success) return new Response("Not found", { status: 404 });
  const setup = await smsSetup(studio);
  if (!setup?.account) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") fields[key] = value;
  // Signed for the public address (requests arrive here through the proxy).
  const url = `${siteUrl}/api/twilio/sms/${studio}`;
  if (!validTwilioSignature(setup.account.token, url, fields, request.headers.get("x-twilio-signature") ?? "")) {
    return new Response("Bad signature", { status: 403 });
  }

  const choice = replyKeyword(fields.Body ?? "");
  if (choice && fields.From) await setConsent(studio, fields.From, choice, "reply");
  return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
