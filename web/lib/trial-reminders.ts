import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { formatDate } from "@/lib/booking/time";
import { trialEndingStudio } from "@/lib/email/messages";
import { sendEmail } from "@/lib/email/send";
import { PLAN_LABELS, PLAN_LIMITS, PLAN_PRICES, formatStorage, trialDaysLeft } from "@/lib/plans";
import { planUsage } from "@/lib/plan-usage";
import { siteUrl } from "@/lib/site";

// "Your Pro trial is ending" emails to Free studios still on their trial: one
// about 4 days before it ends (day 10 of 14) and one about a day before (day
// 13). Each is claimed before it's sent, so two runs at once can't send twice
// (see lib/email/reminders.ts).

const DAY = 24 * 60 * 60 * 1000;
const MID_DAYS = 4;
const FINAL_DAYS = 1;

export async function sendTrialReminders(now = new Date()) {
  const due = await db
    .select({
      id: photographers.id,
      name: photographers.name,
      email: photographers.email,
      timeZone: photographers.timeZone,
      trialEndsAt: photographers.trialEndsAt,
      midSentAt: photographers.trialMidReminderSentAt,
    })
    .from(photographers)
    .where(
      and(
        eq(photographers.plan, "free"),
        gt(photographers.trialEndsAt, now),
        lte(photographers.trialEndsAt, new Date(now.getTime() + MID_DAYS * DAY)),
        isNull(photographers.trialFinalReminderSentAt),
      ),
    );

  let sent = 0;
  for (const studio of due) {
    const endsAt = studio.trialEndsAt!;
    // If runs were missed and the final window is already here, send just the
    // final email and mark both as done.
    const stage = endsAt.getTime() - now.getTime() <= FINAL_DAYS * DAY ? "final" : "mid";
    if (stage === "mid" && studio.midSentAt) continue;

    const claimed = await db
      .update(photographers)
      .set(stage === "final" ? { trialFinalReminderSentAt: now, trialMidReminderSentAt: studio.midSentAt ?? now } : { trialMidReminderSentAt: now })
      .where(
        and(
          eq(photographers.id, studio.id),
          isNull(stage === "final" ? photographers.trialFinalReminderSentAt : photographers.trialMidReminderSentAt),
        ),
      )
      .returning({ id: photographers.id });
    if (claimed.length === 0) continue;

    const usage = await planUsage(studio.id);
    const free = PLAN_LIMITS.free;
    const content = trialEndingStudio({
      name: studio.name,
      stage,
      daysLeft: trialDaysLeft(endsAt, now),
      endsOn: formatDate(endsAt, studio.timeZone),
      activeGalleries: usage.activeGalleries,
      storage: formatStorage(usage.storageBytes),
      freeGalleries: free.activeGalleries ?? 0,
      freeStorage: formatStorage(free.storageBytes),
      overGalleries: free.activeGalleries !== null && usage.activeGalleries > free.activeGalleries,
      overStorage: usage.storageBytes > free.storageBytes,
      billingUrl: `${siteUrl}/dashboard/billing`,
      proMonthlyCents: PLAN_PRICES.pro.month,
    });
    const ok = await sendEmail({
      photographerId: studio.id,
      kind: "trial_reminder",
      to: studio.email,
      content,
      fromName: "PhotoEZ Cloud",
      studioName: "PhotoEZ Cloud",
      footer: `PhotoEZ Cloud account email about your ${PLAN_LABELS.pro} trial.`,
    });
    if (ok) sent++;
  }
  return sent;
}
