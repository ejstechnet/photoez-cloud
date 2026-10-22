import { and, desc, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { growthAudit, growthOpportunities, photographers } from "@/db/schema";
import { localDateOf } from "@/lib/booking/time";
import { sendEmail } from "@/lib/email/send";
import type { EmailContent } from "@/lib/email/layout";
import { siteUrl } from "@/lib/site";
import type { GrowthTier } from "./constants";
import { CLOSED_STATUSES } from "./pipeline";

// The daily Growth email to PhotoEZ Cloud's owner: new posts worth a reply
// (with their scores) and follow-ups that are due. Sent once a day after
// 8 a.m. in the owner's time zone, and only when there's something to read.
// Tested in digest.test.ts.

export const DIGEST_HOUR = 8;
const MAX_LISTED = 10;
const TIER_WORDS: Record<GrowthTier, string> = { high: "High priority", review: "Worth a look", low: "Low priority" };

// The owner's account (the first of OWNER_EMAILS): where the email goes and
// whose Email log it's recorded in.
export async function ownerAccount() {
  const email = (process.env.OWNER_EMAILS ?? "").split(",")[0]?.trim().toLowerCase();
  if (!email) return null;
  const [owner] = await db
    .select({ id: photographers.id, email: photographers.email, name: photographers.name, timeZone: photographers.timeZone })
    .from(photographers)
    .where(eq(photographers.email, email));
  return owner ?? null;
}

export type DigestPost = { id: string; title: string; score: number | null; tier: GrowthTier | null; source: string | null };

export async function digestData(since: Date, now: Date) {
  const open = notInArray(growthOpportunities.status, [...CLOSED_STATUSES]);
  const score = sql<number | null>`coalesce(${growthOpportunities.scoreOverride}, ${growthOpportunities.score})`;
  const pick = {
    id: growthOpportunities.id,
    title: sql<string>`coalesce(nullif(${growthOpportunities.title}, ''), left(${growthOpportunities.excerpt}, 120), ${growthOpportunities.url})`,
    score,
    tier: growthOpportunities.tier,
  };
  const [fresh, followUps, [counts]] = await Promise.all([
    db
      .select(pick)
      .from(growthOpportunities)
      .where(
        and(
          gte(growthOpportunities.discoveredAt, since),
          eq(growthOpportunities.screenedOut, false),
          eq(growthOpportunities.status, "new"),
          inArray(growthOpportunities.tier, ["high", "review"]),
        ),
      )
      .orderBy(sql`${score} desc nulls last`)
      .limit(MAX_LISTED),
    db
      .select(pick)
      .from(growthOpportunities)
      .where(and(lte(growthOpportunities.nextActionAt, now), open))
      .orderBy(growthOpportunities.nextActionAt)
      .limit(MAX_LISTED),
    db
      .select({
        found: sql<number>`count(*)::int`,
        screened: sql<number>`count(*) filter (where ${growthOpportunities.screenedOut})::int`,
      })
      .from(growthOpportunities)
      .where(gte(growthOpportunities.discoveredAt, since)),
  ]);
  return { fresh, followUps, found: counts?.found ?? 0, screened: counts?.screened ?? 0 };
}

export type DigestData = Awaited<ReturnType<typeof digestData>>;

const line = (p: Pick<DigestPost, "title" | "score" | "tier">) =>
  `${p.score ?? "?"}/100${p.tier ? ` · ${TIER_WORDS[p.tier]}` : ""}`;

// The email itself (plain text pieces; lib/email/layout.ts makes the HTML).
export function digestContent(data: DigestData, base = siteUrl): EmailContent {
  const n = data.fresh.length;
  const subject =
    n > 0
      ? `Growth: ${n} new post${n === 1 ? "" : "s"} worth a reply`
      : `Growth: ${data.followUps.length} follow-up${data.followUps.length === 1 ? "" : "s"} due`;
  return {
    subject,
    heading: "Your Growth summary",
    intro: [
      n > 0
        ? `${n} new post${n === 1 ? " looks" : "s look"} worth a reply. Each has a drafted reply ready: open it, check it, then Copy & open post.`
        : "No new posts worth a reply since the last summary.",
      data.found > 0
        ? `In all, ${data.found} post${data.found === 1 ? " was" : "s were"} found or saved; ${data.screened} filtered out by the quick AI check.`
        : "",
    ].filter(Boolean),
    details: [
      ...data.fresh.map((p): [string, string] => [line(p), `${p.title}\n${base}/dashboard/growth/${p.id}`]),
      ...data.followUps.map((p): [string, string] => ["Follow up", `${p.title}\n${base}/dashboard/growth/${p.id}`]),
    ],
    button: { label: "Open Growth", url: `${base}/dashboard/growth?sort=score` },
    outro: ["Nothing is ever posted for you: you read, edit, and post every reply yourself."],
  };
}

// Sends today's summary if it's time and there's something in it. Safe to
// call every 15 minutes.
export async function sendGrowthDigest(now = new Date()): Promise<"sent" | "not_yet" | "already" | "empty" | "no_owner" | "failed"> {
  const owner = await ownerAccount();
  if (!owner) return "no_owner";
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: owner.timeZone }).format(now));
  if (hour < DIGEST_HOUR) return "not_yet";
  const today = localDateOf(now, owner.timeZone);

  const [last] = await db
    .select({ createdAt: growthAudit.createdAt, details: growthAudit.details })
    .from(growthAudit)
    .where(eq(growthAudit.action, "digest"))
    .orderBy(desc(growthAudit.createdAt))
    .limit(1);
  if (last?.details.day === today) return "already";

  const since = last?.createdAt ?? new Date(now.getTime() - 24 * 3_600_000);
  const data = await digestData(since, now);
  const empty = data.fresh.length === 0 && data.followUps.length === 0;
  let outcome: "sent" | "empty" | "failed" = "empty";
  if (!empty) {
    const ok = await sendEmail({
      photographerId: owner.id,
      kind: "growth_digest",
      to: owner.email,
      content: digestContent(data),
      fromName: "PhotoEZ Growth",
      studioName: "PhotoEZ Cloud",
      footer: "Your daily Growth summary from PhotoEZ Cloud. Only you get this.",
    });
    outcome = ok ? "sent" : "failed";
  }
  // Recorded either way, so today is done (a failed send shows in the Email log).
  await db.insert(growthAudit).values({ action: "digest", details: { day: today, outcome, fresh: data.fresh.length, followUps: data.followUps.length } });
  return outcome;
}
