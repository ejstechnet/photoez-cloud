"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { supportMessages } from "@/db/schema";
import { auth } from "@/lib/auth";
import { afterResponse, sendEmail } from "@/lib/email/send";
import { ownerAccount } from "@/lib/growth/digest";
import { overLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site";
import { parseSupportForm, supportEmail, type SupportFields } from "@/lib/support";

// The Support page's contact form, for photographers and their clients.
// Anyone can call this, so it guards against spam the way the studio
// inquiry form does: a hidden "website" field only bots fill in, a minimum
// time on the page, and caps on repeat messages.

const MIN_SECONDS_ON_PAGE = 3;
const MAX_PER_EMAIL_PER_HOUR = 3;

export type SupportFormState = {
  errors?: Partial<Record<SupportFields, string>>;
  message?: string;
  sent?: boolean;
};

export async function sendSupportMessage(_prev: SupportFormState, formData: FormData): Promise<SupportFormState> {
  // Bots: act as if it worked, but save nothing.
  const startedAt = Number(formData.get("startedAt"));
  const tooFast = !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_SECONDS_ON_PAGE * 1000;
  if (String(formData.get("website") ?? "") !== "" || tooFast) return { sent: true };

  if (await overLimit("support", 5, 60 * 60 * 1000)) {
    return { message: "You've sent several messages already. Please try again in an hour." };
  }

  const field = (name: SupportFields) => String(formData.get(name) ?? "");
  const parsed = parseSupportForm({
    role: field("role"),
    topic: field("topic"),
    name: field("name"),
    email: field("email"),
    studio: field("studio"),
    pageUrl: field("pageUrl"),
    message: field("message"),
  });
  if ("errors" in parsed) return { errors: parsed.errors };
  const data = parsed.data;

  const [{ recent }] = await db
    .select({ recent: count() })
    .from(supportMessages)
    .where(and(eq(supportMessages.email, data.email), gt(supportMessages.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if (recent >= MAX_PER_EMAIL_PER_HOUR) {
    return { message: "Thanks! We already have your messages and will reply by email soon." };
  }

  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const userAgent = h.get("user-agent")?.slice(0, 300) || null;

  await db.insert(supportMessages).values({ ...data, userAgent, photographerId: session?.user.id ?? null });

  // The sender sees the thank-you right away; the email goes after.
  afterResponse(async () => {
    const owner = await ownerAccount();
    if (!owner) return;
    await sendEmail({
      photographerId: owner.id,
      kind: "support_message",
      to: owner.email,
      content: supportEmail(data, {
        account: session ? session.user.email : null,
        userAgent,
        inboxUrl: `${siteUrl}/dashboard/support`,
      }),
      fromName: "PhotoEZ Cloud Support",
      studioName: "PhotoEZ Cloud",
      footer: "A message from the PhotoEZ Cloud Support page. Only you get this.",
      replyTo: data.email,
    });
  });

  return { sent: true };
}
