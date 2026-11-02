import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { newStudioSignup } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { ownerAccount } from "@/lib/growth/digest";
import { TRIAL_DAYS } from "@/lib/plans";
import { describeAnswers, type QuizAnswers } from "@/lib/quiz";
import { isOwnerEmail } from "@/lib/signup-stats";
import { siteUrl } from "@/lib/site";

// Emails PhotoEZ Cloud's owner (the first of OWNER_EMAILS) when a new studio
// signs up, by email or with Google. Called from lib/auth.ts right after the
// account is created; recorded in the owner's Email log.
export async function notifyOwnerOfSignup(
  studio: { id: string; name: string; email: string; emailVerified: boolean; businessName?: string | null },
  from: { source: string | null; quiz: QuizAnswers | null },
) {
  if (isOwnerEmail(studio.email)) return;
  const owner = await ownerAccount();
  if (!owner) return;

  const [[row], [{ studios }]] = await Promise.all([
    db.select({ referredById: photographers.referredById }).from(photographers).where(eq(photographers.id, studio.id)),
    db.select({ studios: count() }).from(photographers),
  ]);
  let referredBy: string | null = null;
  if (row?.referredById) {
    const [referrer] = await db
      .select({ name: photographers.name, businessName: photographers.businessName })
      .from(photographers)
      .where(eq(photographers.id, row.referredById));
    referredBy = referrer ? referrer.businessName || referrer.name : null;
  }

  await sendEmail({
    photographerId: owner.id,
    kind: "signup_new",
    to: owner.email,
    content: newStudioSignup({
      name: studio.name,
      businessName: studio.businessName?.trim() || null,
      email: studio.email,
      withGoogle: studio.emailVerified,
      referredBy,
      source: from.source,
      quiz: from.quiz ? describeAnswers(from.quiz) : null,
      trialDays: TRIAL_DAYS,
      studioCount: studios,
      signupsUrl: `${siteUrl}/dashboard/signups`,
    }),
    fromName: "PhotoEZ Cloud",
    studioName: "PhotoEZ Cloud",
    footer: "Sent to you as PhotoEZ Cloud's owner whenever a new studio signs up.",
    replyTo: studio.email,
  });
}
