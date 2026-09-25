"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { inquiries, photographers } from "@/db/schema";
import { runTriage } from "@/lib/inquiries";
import { SESSION_LABELS, type SessionType } from "@/lib/session-types";

// The public inquiry form on a studio page. Anyone can call this, so it
// guards against spam without a CAPTCHA: a hidden "website" field that only
// bots fill in, a minimum time on the page, and a cap on repeat submissions.

const MIN_SECONDS_ON_PAGE = 3;
const MAX_PER_EMAIL_PER_HOUR = 3;

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.email("Enter a valid email address.").trim().max(254),
  phone: z.string().trim().max(40).transform((v) => v || null),
  sessionType: z.string().trim(),
  preferredDate: z.string().trim().max(120).transform((v) => v || null),
  message: z
    .string()
    .trim()
    .min(10, "Tell the photographer a little about what you have in mind.")
    .max(5000, "Keep your message under 5,000 characters."),
});

export type InquiryFormState = {
  errors?: Partial<Record<keyof z.input<typeof formSchema>, string>>;
  message?: string;
  sent?: { quote: boolean };
};

export async function submitInquiry(
  slug: string,
  _prev: InquiryFormState,
  formData: FormData,
): Promise<InquiryFormState> {
  // Bots: act as if it worked, but save nothing.
  const startedAt = Number(formData.get("startedAt"));
  const tooFast = !Number.isFinite(startedAt) || Date.now() - startedAt < MIN_SECONDS_ON_PAGE * 1000;
  if (String(formData.get("website") ?? "") !== "" || tooFast) return { sent: { quote: false } };

  const [studio] = await db
    .select({
      id: photographers.id,
      name: photographers.name,
      businessName: photographers.businessName,
      offeredTypes: photographers.offeredTypes,
      quoteOnlyTypes: photographers.quoteOnlyTypes,
    })
    .from(photographers)
    .where(eq(photographers.studioSlug, slug));
  if (!studio) return { message: "This studio page isn't available anymore." };

  const parsed = formSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    sessionType: String(formData.get("sessionType") ?? ""),
    preferredDate: String(formData.get("preferredDate") ?? ""),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) {
    const errors: InquiryFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof z.input<typeof formSchema>;
      errors[field] ??= issue.message;
    }
    return { errors };
  }
  const data = parsed.data;
  if (data.sessionType !== "other" && !studio.offeredTypes.includes(data.sessionType)) {
    return { errors: { sessionType: "Choose a session type from the list." } };
  }

  const [{ recent }] = await db
    .select({ recent: count() })
    .from(inquiries)
    .where(
      and(
        eq(inquiries.photographerId, studio.id),
        eq(inquiries.fromEmail, data.email),
        gt(inquiries.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    );
  if (recent >= MAX_PER_EMAIL_PER_HOUR) {
    return { message: "Thanks! We already have your messages. The studio will be in touch soon." };
  }

  const quote = studio.quoteOnlyTypes.includes(data.sessionType);
  const sessionLabel = SESSION_LABELS[data.sessionType as SessionType] ?? "Something else";

  // What the form collected, written out the way the AI triage reads inquiries.
  const message = [
    `Session: ${sessionLabel}${quote ? " (requesting a quote)" : ""}`,
    data.preferredDate && `Preferred date: ${data.preferredDate}`,
    data.phone && `Phone: ${data.phone}`,
    "",
    data.message,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const [inquiry] = await db
    .insert(inquiries)
    .values({
      photographerId: studio.id,
      source: "form",
      fromName: data.name,
      fromEmail: data.email,
      message,
    })
    .returning();

  // The client sees the thank-you right away; triage runs after the response.
  after(async () => {
    await runTriage(inquiry, studio);
    revalidatePath("/dashboard", "layout");
  });

  return { sent: { quote } };
}
