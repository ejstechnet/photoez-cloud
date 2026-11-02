import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { photographers, studioEmailRecipients, studioEmailSends, studioEmailTemplates } from "@/db/schema";
import { sendEmail } from "@/lib/email/send";
import { ownerAccount } from "@/lib/growth/digest";
import { isOwnerEmail } from "@/lib/signup-stats";
import { siteUrl } from "@/lib/site";
import { starterTemplates, studioEmailContent, studioEmailFooter, type Draft, type StudioRow } from "@/lib/studio-emails";
import { unsubscribeToken } from "@/lib/unsubscribe";

// Sending the owner's emails to studios (Settings > Email studios). Each send
// is saved with one row per studio, then goes out in small batches with a
// pause between them, so a big send never floods the mail server and hurts
// how inboxes treat PhotoEZ Cloud's other email. A send cut short (say, by a
// deploy) picks up where it stopped with Resume.

const BATCH_SIZE = 10;
const PAUSE_MS = 3000;
export const MAX_RECIPIENTS = 1000;

// The PhotoEZ Cloud logo for the top of these emails (PNG, which every email
// app can show).
export const EMAIL_LOGO = { url: `${siteUrl}/brand/photoez-cloud-logo-email.png`, background: "#ffffff" };

// Every studio but the owner's own, newest first.
export async function listStudios(): Promise<StudioRow[]> {
  const rows = await db
    .select({
      id: photographers.id,
      name: photographers.name,
      businessName: photographers.businessName,
      email: photographers.email,
      plan: photographers.plan,
      trialEndsAt: photographers.trialEndsAt,
      emailVerified: photographers.emailVerified,
      createdAt: photographers.createdAt,
      optedOutAt: photographers.marketingOptOutAt,
    })
    .from(photographers)
    .orderBy(desc(photographers.createdAt));
  return rows
    .filter((r) => !isOwnerEmail(r.email))
    .map(({ optedOutAt, ...r }) => ({ ...r, optedOut: optedOutAt !== null }));
}

// The starter templates, the first time the page opens (never again once
// anything has been sent, so deleting them all sticks).
export async function ensureStarterTemplates() {
  const [[{ templates }], [{ sends }]] = await Promise.all([
    db.select({ templates: count() }).from(studioEmailTemplates),
    db.select({ sends: count() }).from(studioEmailSends),
  ]);
  if (templates > 0 || sends > 0) return;
  await db.insert(studioEmailTemplates).values(starterTemplates(siteUrl));
}

export async function listTemplates() {
  return db.select().from(studioEmailTemplates).orderBy(asc(studioEmailTemplates.createdAt));
}

type Owner = { id: string; name: string; email: string };

// One studio's email, sent now; replies go to the owner. False when it didn't go out.
async function sendOne(owner: Owner, draft: Draft, studio: { id: string; name: string; businessName: string | null; email: string }) {
  const token = unsubscribeToken(studio.id);
  return sendEmail({
    photographerId: owner.id,
    kind: "studio_email",
    to: studio.email,
    content: studioEmailContent(draft, studio),
    fromName: `${owner.name.trim().split(/\s+/)[0] || "PhotoEZ"} at PhotoEZ Cloud`,
    studioName: "PhotoEZ Cloud",
    logo: EMAIL_LOGO,
    footer: studioEmailFooter(`${siteUrl}/unsubscribe/${token}`),
    replyTo: owner.email,
    // Lets Gmail and others show their own Unsubscribe button (one click, RFC 8058).
    headers: {
      "List-Unsubscribe": `<${siteUrl}/api/unsubscribe/${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

// "Send me a test": the draft as the first chosen studio will see it (or as
// the owner, with none chosen), to the owner's inbox.
export async function sendTest(draft: Draft, sampleStudioId: string | null) {
  const owner = await ownerAccount();
  if (!owner) return false;
  const [sample] = sampleStudioId
    ? await db
        .select({ id: photographers.id, name: photographers.name, businessName: photographers.businessName })
        .from(photographers)
        .where(eq(photographers.id, sampleStudioId))
    : [];
  const as = sample ?? { id: owner.id, name: owner.name, businessName: null };
  return sendOne(owner, { ...draft, subject: `[Test] ${draft.subject}` }, { ...as, email: owner.email });
}

// Saves a send and its studios (leaving out the owner and anyone who
// unsubscribed). Returns the send and how many it will go to.
export async function createSend(draft: Draft, studioIds: string[], templateName: string | null) {
  const ids = [...new Set(studioIds)].slice(0, MAX_RECIPIENTS);
  const studios = ids.length
    ? await db
        .select({ id: photographers.id, email: photographers.email })
        .from(photographers)
        .where(and(inArray(photographers.id, ids), isNull(photographers.marketingOptOutAt)))
    : [];
  const recipients = studios.filter((s) => !isOwnerEmail(s.email));
  if (recipients.length === 0) return null;
  const [send] = await db
    .insert(studioEmailSends)
    .values({ ...draft, subject: draft.subject.trim(), heading: draft.heading.trim(), templateName })
    .returning({ id: studioEmailSends.id });
  await db
    .insert(studioEmailRecipients)
    .values(recipients.map((s) => ({ sendId: send.id, photographerId: s.id, email: s.email })));
  return { sendId: send.id, count: recipients.length };
}

// Sends being worked through right now. The app runs as one process, so this
// stops a Resume click from sending the same emails twice alongside it; after
// a restart it's empty and Resume picks up the rest.
const running = new Set<string>();

// Sends a send's waiting emails in batches, then marks it done. Safe to run
// again (Resume): only emails still waiting go out.
export async function processSend(sendId: string, pauseMs = PAUSE_MS) {
  if (running.has(sendId)) return;
  running.add(sendId);
  try {
    await work(sendId, pauseMs);
  } finally {
    running.delete(sendId);
  }
}

async function work(sendId: string, pauseMs: number) {
  const owner = await ownerAccount();
  const [send] = await db.select().from(studioEmailSends).where(eq(studioEmailSends.id, sendId));
  if (!owner || !send) return;
  const draft: Draft = { subject: send.subject, heading: send.heading, body: send.body, buttonLabel: send.buttonLabel, buttonUrl: send.buttonUrl };

  for (;;) {
    const batch = await db
      .select({
        id: studioEmailRecipients.id,
        studioId: photographers.id,
        name: photographers.name,
        businessName: photographers.businessName,
        email: studioEmailRecipients.email,
        optedOutAt: photographers.marketingOptOutAt,
      })
      .from(studioEmailRecipients)
      .leftJoin(photographers, eq(photographers.id, studioEmailRecipients.photographerId))
      .where(and(eq(studioEmailRecipients.sendId, sendId), eq(studioEmailRecipients.status, "pending")))
      .limit(BATCH_SIZE);
    if (batch.length === 0) break;

    for (const r of batch) {
      // Unsubscribed (or deleted their account) since the send was saved.
      if (!r.studioId || r.optedOutAt) {
        await db.update(studioEmailRecipients).set({ status: "skipped" }).where(eq(studioEmailRecipients.id, r.id));
        continue;
      }
      const ok = await sendOne(owner, draft, { id: r.studioId, name: r.name!, businessName: r.businessName, email: r.email }).catch(
        () => false,
      );
      await db
        .update(studioEmailRecipients)
        .set(
          ok
            ? { status: "sent", sentAt: new Date(), error: null }
            : { status: "failed", error: "Didn't go through. The Email log shows why." },
        )
        .where(eq(studioEmailRecipients.id, r.id));
    }
    if (pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }

  await db.update(studioEmailSends).set({ status: "done", finishedAt: new Date() }).where(eq(studioEmailSends.id, sendId));
}

// Past sends, newest first, with how each went.
export async function sendHistory() {
  const sends = await db.select().from(studioEmailSends).orderBy(desc(studioEmailSends.createdAt)).limit(50);
  if (sends.length === 0) return [];
  const counts = await db
    .select({ sendId: studioEmailRecipients.sendId, status: studioEmailRecipients.status, n: count() })
    .from(studioEmailRecipients)
    .where(inArray(studioEmailRecipients.sendId, sends.map((s) => s.id)))
    .groupBy(studioEmailRecipients.sendId, studioEmailRecipients.status);
  return sends.map((s) => {
    const tally = { pending: 0, sent: 0, failed: 0, skipped: 0 };
    for (const c of counts) if (c.sendId === s.id) tally[c.status] = c.n;
    return { ...s, ...tally, total: tally.pending + tally.sent + tally.failed + tally.skipped };
  });
}
