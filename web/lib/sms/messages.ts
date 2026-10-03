import { formatPrice } from "../booking/format.ts";

// The wording of every text, kept short (one or two SMS segments). Client
// texts start with the studio's name and end with how to stop them, as US
// carriers require. Pure logic, tested in sms.test.ts.

export type SmsSettings = {
  sessionReminder: boolean;
  paymentDue: boolean;
  galleryReady: boolean;
  galleryExpiring: boolean;
  // New booking / new inquiry texts to the studio's own phone.
  studioAlerts: boolean;
};
export type SmsKind = keyof SmsSettings;

export const DEFAULT_SMS_SETTINGS: SmsSettings = {
  sessionReminder: true,
  paymentDue: true,
  galleryReady: true,
  galleryExpiring: true,
  studioAlerts: true,
};

export const SMS_LABELS: Record<SmsKind, { label: string; note: string }> = {
  sessionReminder: { label: "Session reminder", note: "Sent with the reminder email before each session." },
  paymentDue: { label: "Payment due", note: "Booking balances and invoice payments, with a link to pay." },
  galleryReady: { label: "Gallery ready", note: "When you deliver the final photos." },
  galleryExpiring: { label: "Gallery closing soon", note: "Sent with the reminder email before a gallery closes." },
  studioAlerts: { label: "Texts to you", note: "New bookings and new inquiries, to your own phone." },
};

export const settingsWithDefaults = (s: Partial<SmsSettings> | null | undefined): SmsSettings => ({ ...DEFAULT_SMS_SETTINGS, ...(s ?? {}) });

const STOP = "Reply STOP to opt out.";
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export function sessionReminderText(o: { studio: string; client: string; session: string; when: string; url: string }) {
  return `${o.studio}: Hi ${first(o.client)}, a reminder that your ${o.session} session is ${o.when}. Details: ${o.url} ${STOP}`;
}

export function paymentDueText(o: { studio: string; client: string; what: string; amountCents: number; due: string | null; url: string; overdue?: boolean }) {
  const when = o.overdue ? `was due ${o.due}` : o.due ? `is due ${o.due}` : "is due";
  return `${o.studio}: Hi ${first(o.client)}, your ${o.what} of ${formatPrice(o.amountCents)} ${when}. Pay here: ${o.url} ${STOP}`;
}

export function galleryReadyText(o: { studio: string; client: string; url: string }) {
  return `${o.studio}: Hi ${first(o.client)}, your final photos are ready! View and download them here: ${o.url} ${STOP}`;
}

export function galleryExpiringText(o: { studio: string; client: string; expires: string; url: string; delivered: boolean }) {
  const what = o.delivered ? "Download your photos before then" : "Make your picks before then";
  return `${o.studio}: Hi ${first(o.client)}, your gallery closes ${o.expires}. ${what}: ${o.url} ${STOP}`;
}

export function newBookingAlert(o: { client: string; session: string; when: string; url: string }) {
  return `PhotoEZ Cloud: New booking! ${o.client}, ${o.session}, ${o.when}. ${o.url}`;
}

export function newInquiryAlert(o: { from: string; summary: string | null; url: string }) {
  const about = o.summary ? ` ${o.summary.length > 120 ? `${o.summary.slice(0, 117).trimEnd()}…` : o.summary}` : "";
  return `PhotoEZ Cloud: New inquiry from ${o.from}.${about} ${o.url}`;
}

export function testText(studio: string) {
  return `${studio}: This is a test text from PhotoEZ Cloud. Texting is set up!`;
}

// Words a client can reply with (Twilio's standard opt-out and opt-in words).
const OPT_OUT = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"];
const OPT_IN = ["START", "YES", "UNSTOP", "OPTIN"];

export function replyKeyword(body: string): "out" | "in" | null {
  const word = body.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (OPT_OUT.includes(word)) return "out";
  if (OPT_IN.includes(word)) return "in";
  return null;
}

// Plain words for Twilio's common delivery errors (shown in the Text log).
const DELIVERY_ERRORS: Record<number, string> = {
  30034: "Blocked by the carrier: this number isn't registered for business texting (A2P 10DLC). Register it in Twilio.",
  30007: "Blocked by the carrier as possible spam.",
  30003: "The phone was off or out of service.",
  30005: "That number doesn't exist or is no longer in service.",
  30006: "That number can't get texts (likely a landline).",
  30008: "The carrier couldn't deliver it (unknown reason).",
  21610: "They replied STOP, so Twilio won't text them.",
};

export function deliveryError(code: number | null) {
  if (!code) return "Not delivered.";
  return `${DELIVERY_ERRORS[code] ?? "Not delivered."} (Twilio error ${code})`;
}
