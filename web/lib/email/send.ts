import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { emailLog, photographers } from "@/db/schema";
import { siteUrl } from "@/lib/site";
import { renderEmail, type EmailContent, type EmailLogo } from "./layout";

// Sends the app's emails through SMTP (on the live server, the VPS's own mail
// server) and records every one in email_log. Settings come from web/.env:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM. Without SMTP_HOST
// (e.g. on a developer's computer) nothing is sent, but the email is still
// logged as "skipped" so it can be read in the dashboard's Email log.

export type EmailKind =
  | "booking_confirmed"
  | "booking_new"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "contract_signed"
  | "payment_received"
  | "session_reminder"
  | "balance_reminder"
  | "gallery_link"
  | "gallery_finals"
  | "gallery_expiring"
  | "selections_submitted"
  | "inquiry_reply"
  | "inquiry_new"
  | "password_reset"
  | "test";

let transport: nodemailer.Transporter | null | undefined;

function getTransport() {
  if (transport !== undefined) return transport;
  const host = process.env.SMTP_HOST;
  transport = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        requireTLS: Number(process.env.SMTP_PORT ?? 587) !== 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : null;
  return transport;
}

// Who a studio's emails come from and where its notices go.
export async function studioSender(photographerId: string) {
  const [studio] = await db
    .select({
      name: photographers.name,
      email: photographers.email,
      businessName: photographers.businessName,
      notifyEmail: photographers.notifyEmail,
      logoKey: photographers.studioLogoKey,
      logoBg: photographers.studioLogoBg,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!studio) return null;
  return {
    studioName: studio.businessName || studio.name,
    // Client replies and the studio's own notices both go here.
    inbox: studio.notifyEmail || studio.email,
    logo: studio.logoKey ? { url: `${siteUrl}/email-logo/${photographerId}`, background: studio.logoBg } : null,
  };
}

// Strips characters that could break an email header.
const headerSafe = (text: string) => text.replace(/[\r\n"<>]/g, " ").trim();

export async function sendEmail(options: {
  photographerId: string;
  kind: EmailKind;
  to: string;
  content: EmailContent;
  // Shown as the sender's name, e.g. the studio's name.
  fromName: string;
  // The name (and logo, if the studio has one) at the top of the email.
  studioName: string;
  logo?: EmailLogo | null;
  footer: string;
  replyTo?: string | null;
  bookingId?: string | null;
  galleryId?: string | null;
  inquiryId?: string | null;
}): Promise<boolean> {
  const email = renderEmail(options.content, {
    studioName: options.studioName,
    footer: options.footer,
    logo: options.logo,
  });
  const transporter = getTransport();
  let status: "sent" | "failed" | "skipped" = "skipped";
  let error: string | null = transporter ? null : "Email sending isn't set up here (no SMTP_HOST).";

  if (transporter) {
    try {
      await transporter.sendMail({
        from: { name: headerSafe(options.fromName), address: process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? "" },
        to: options.to,
        replyTo: options.replyTo || undefined,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message.slice(0, 500) : "Unknown error";
      console.error(`Email "${options.kind}" to ${options.to} failed:`, e);
    }
  }

  try {
    await db.insert(emailLog).values({
      photographerId: options.photographerId,
      kind: options.kind,
      toEmail: options.to,
      subject: email.subject,
      html: email.html,
      status,
      error,
      bookingId: options.bookingId ?? null,
      galleryId: options.galleryId ?? null,
      inquiryId: options.inquiryId ?? null,
    });
  } catch (e) {
    console.error("Couldn't write the email log", e);
  }
  return status === "sent";
}

// Email to a client, from the studio: their name as the sender, replies go
// to the studio's inbox.
export async function sendToClient(
  photographerId: string,
  kind: EmailKind,
  to: string,
  content: EmailContent,
  refs: { bookingId?: string; galleryId?: string; inquiryId?: string } = {},
) {
  const studio = await studioSender(photographerId);
  if (!studio) return false;
  return sendEmail({
    photographerId,
    kind,
    to,
    content,
    fromName: studio.studioName,
    studioName: studio.studioName,
    logo: studio.logo,
    footer: `Sent by ${studio.studioName} with PhotoEZ Cloud. Reply to this email to reach ${studio.studioName}.`,
    replyTo: studio.inbox,
    ...refs,
  });
}

// A notice to the studio itself; replies go to the client when there is one.
export async function sendToStudio(
  photographerId: string,
  kind: EmailKind,
  content: EmailContent,
  refs: { bookingId?: string; galleryId?: string; inquiryId?: string; replyTo?: string | null } = {},
) {
  const studio = await studioSender(photographerId);
  if (!studio) return false;
  const { replyTo, ...ids } = refs;
  return sendEmail({
    photographerId,
    kind,
    to: studio.inbox,
    content,
    fromName: "PhotoEZ Cloud",
    studioName: studio.studioName,
    logo: studio.logo,
    footer: "A notice from PhotoEZ Cloud about your studio. Change where these go in Settings.",
    replyTo,
    ...ids,
  });
}

// Runs email work after the response is sent, so a slow or failing mail
// server never holds up the person clicking the button. Outside a request
// (e.g. a scheduled job) it simply runs now.
export function afterResponse(work: () => Promise<unknown>) {
  const run = () => work().catch((e) => console.error("Email work failed", e));
  try {
    after(run);
  } catch {
    void run();
  }
}
