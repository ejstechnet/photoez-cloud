import { createHmac, timingSafeEqual } from "node:crypto";

// Twilio signs every request it sends us (X-Twilio-Signature) with the
// account's auth token: HMAC-SHA1 of the full URL followed by each posted
// field's name and value, sorted by name, in base64. Tested in sms.test.ts.

export function twilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string) {
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
