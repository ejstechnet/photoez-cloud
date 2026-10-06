import { createHash } from "node:crypto";
import { and, eq, gt, inArray, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assistantProposals, bookings, clients, galleries, type ProposalDelivery } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { firstName } from "@/lib/email/messages";
import { bookingTotal, prepaid } from "@/lib/payments/amounts";
import { needsApproval, toolEffect } from "./registry";
import { addLateStep, settleTrace } from "./trace";
import { prepareAction, readTool, type Proposal, type ToolContext } from "./tools";

// The one place a Studio Assistant tool runs (executeTool), and the life of
// an approval card around it:
//
//   1. The model calls a "propose_" tool → requestAction saves a pending card.
//      Nothing runs.
//   2. The photographer clicks Approve → decideAction (signed in, their own
//      card, not expired) marks it approved. Only a person can do this; no
//      tool can.
//   3. executeTool runs it: only an approved, unexpired card of this studio,
//      claimed approved → executing in one update (so it runs once), with
//      the stored payload, checked against its hash. Everything is checked
//      again (still this studio's, still owing, still delivered…) first.
//
// executeTool refuses any write/external tool without an approved card, no
// matter what the model said. Emails and booking changes come in as
// `effects`, so tests can prove nothing was sent.

export const CARD_LIFETIME_MS = 24 * 60 * 60 * 1000;

export class ApprovalRequiredError extends Error {
  constructor(tool: string) {
    super(`${tool} needs the photographer's approval and can't run without an approved card.`);
    this.name = "ApprovalRequiredError";
  }
}
export class ActionRefusedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ActionRefusedError";
  }
}

// What approved cards are allowed to do. Real ones send email and change
// bookings (app/dashboard/assistant/actions.ts); tests pass counters.
export type ActionEffects = {
  emailClient(photographerId: string, to: { name: string; email: string }, subject: string, body: string): Promise<boolean>;
  galleryEmail(kind: "link" | "closing_soon" | "review_request", galleryId: string): Promise<boolean>;
  balanceReminder(bookingId: string): Promise<boolean>;
  bookingStatus(bookingId: string, status: "completed" | "cancelled"): Promise<boolean>;
};

// The same JSON whatever order its keys are in.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value ?? null;
}

// Fingerprint of exactly what a card will do.
export function argsHash(tool: string, args: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical({ tool, args }))).digest("hex");
}

// ---- 1. The model asks ----------------------------------------------------

// A "propose_" tool call: prepares and saves a pending card. Never runs it.
export async function requestAction(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext & { traceId: string | null },
  now = new Date(),
): Promise<{ text: string; proposal?: Proposal }> {
  if (!needsApproval(name)) throw new Error(`${name} isn't an action tool.`);
  const prepared = await prepareAction(name, input, ctx);
  if (!("kind" in prepared)) return { text: prepared.text };
  const [row] = await db
    .insert(assistantProposals)
    .values({
      photographerId: ctx.photographerId,
      kind: prepared.kind,
      toolName: name,
      payload: prepared.payload,
      argsHash: argsHash(name, prepared.payload),
      summary: prepared.summary,
      traceId: ctx.traceId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + CARD_LIFETIME_MS),
    })
    .returning({ id: assistantProposals.id });
  return {
    text: `Waiting for the photographer's approval (nothing sent or changed yet): ${prepared.summary}. They'll see a card with an Approve button.`,
    proposal: { id: row.id, kind: prepared.kind, summary: prepared.summary, details: prepared.details },
  };
}

// ---- 2. The photographer decides -------------------------------------------

type Card = typeof assistantProposals.$inferSelect;
export type Decision = { ok: true; card: Card } | { ok: false; reason: "not_found" | "expired" | "already_decided" };

// Approve or dismiss a pending card. photographerId is the signed-in
// photographer: someone else's card is "not_found".
export async function decideAction(proposalId: string, photographerId: string, decision: "approve" | "dismiss", now = new Date()): Promise<Decision> {
  if (!z.uuid().safeParse(proposalId).success) return { ok: false, reason: "not_found" };
  const [card] = await db
    .update(assistantProposals)
    .set(
      decision === "approve"
        ? { status: "approved", decidedAt: now, decidedBy: photographerId }
        : { status: "rejected", decidedAt: now, decidedBy: photographerId, doneAt: now },
    )
    .where(
      and(
        eq(assistantProposals.id, proposalId),
        eq(assistantProposals.photographerId, photographerId),
        eq(assistantProposals.status, "pending"),
        gt(assistantProposals.expiresAt, now),
      ),
    )
    .returning();
  if (card) {
    await addLateStep(card.traceId, photographerId, "approval_decided", {
      toolName: card.toolName,
      toolOutput: decision === "approve" ? "approved" : "dismissed",
      status: decision === "approve" ? "ok" : "refused",
    });
    await settleTrace(card.traceId);
    return { ok: true, card };
  }

  const [existing] = await db
    .select({ status: assistantProposals.status })
    .from(assistantProposals)
    .where(and(eq(assistantProposals.id, proposalId), eq(assistantProposals.photographerId, photographerId)));
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.status === "pending" || existing.status === "expired") {
    await expireProposals(now, photographerId);
    return { ok: false, reason: "expired" };
  }
  return { ok: false, reason: "already_decided" };
}

// Pending cards past their 24 hours become expired (cron job, and when a
// conversation is reopened).
export async function expireProposals(now = new Date(), photographerId?: string) {
  const gone = await db
    .update(assistantProposals)
    .set({ status: "expired", doneAt: now })
    .where(
      and(
        eq(assistantProposals.status, "pending"),
        lte(assistantProposals.expiresAt, now),
        photographerId ? eq(assistantProposals.photographerId, photographerId) : undefined,
      ),
    )
    .returning({ id: assistantProposals.id });
  return gone.length;
}

// ---- 3. The one place tools run --------------------------------------------

// Runs any Assistant tool. Look-ups run straight away. Anything that writes
// or reaches outside the app needs `approval`: the id of this studio's
// approved, unexpired card for this tool with exactly these args.
// `complete` is false when some recipients didn't get it (the card is then
// "failed", and the rest can be tried again).
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  approval?: { pendingActionId: string; effects: ActionEffects; now?: Date },
): Promise<{ text: string; complete?: boolean }> {
  const effect = toolEffect(name);
  if (!effect) throw new Error(`Unknown tool ${name}.`);
  if (effect === "read") return readTool(name, args, ctx);
  if (!approval?.pendingActionId || !z.uuid().safeParse(approval.pendingActionId).success) throw new ApprovalRequiredError(name);

  const now = approval.now ?? new Date();
  const hash = argsHash(name, args);
  // Claim it: approved → executing in one conditional update, so it runs once.
  const [card] = await db
    .update(assistantProposals)
    .set({ status: "executing", runStartedAt: now })
    .where(
      and(
        eq(assistantProposals.id, approval.pendingActionId),
        eq(assistantProposals.photographerId, ctx.photographerId),
        eq(assistantProposals.toolName, name),
        eq(assistantProposals.status, "approved"),
        gt(assistantProposals.expiresAt, now),
        eq(assistantProposals.argsHash, hash),
      ),
    )
    .returning();
  if (!card) throw new ActionRefusedError(await whyRefused(approval.pendingActionId, ctx.photographerId, name, hash, now));

  // The stored payload is what runs, and it must still match its fingerprint.
  if (argsHash(card.toolName, card.payload) !== card.argsHash) {
    await finishCard(card.id, "failed", "Nothing was sent.", "The card's details changed after approval.");
    throw new ActionRefusedError("The card's details changed after approval, so nothing was run.");
  }
  try {
    const run = await runAction(card, approval.effects);
    await finishCard(card.id, run.complete ? "executed" : "failed", run.summary, run.complete ? null : "Not everyone got it.");
    await addLateStep(card.traceId, card.photographerId, "tool_call", {
      toolName: name,
      toolOutput: { result: run.summary, deliveries: run.deliveries },
      status: run.complete ? "ok" : "error",
    });
    return { text: run.summary, complete: run.complete };
  } catch (error) {
    // A crash part way: who got it so far is already saved on the card.
    console.error("Running an approved assistant card failed", error);
    const why = error instanceof Error ? error.message : String(error);
    const [latest] = await db
      .select({ deliveries: assistantProposals.deliveries })
      .from(assistantProposals)
      .where(eq(assistantProposals.id, card.id));
    await finishCard(card.id, "failed", summarize(card.kind, latest?.deliveries ?? []).summary, why);
    await addLateStep(card.traceId, card.photographerId, "tool_call", { toolName: name, status: "error", error: `Failed after approval: ${why}` });
    throw error;
  }
}

async function finishCard(id: string, status: "executed" | "failed", result: string | null, error: string | null) {
  await db.update(assistantProposals).set({ status, result, error, doneAt: new Date() }).where(eq(assistantProposals.id, id));
}

async function whyRefused(id: string, photographerId: string, name: string, hash: string, now: Date): Promise<string> {
  const [card] = await db
    .select()
    .from(assistantProposals)
    .where(and(eq(assistantProposals.id, id), eq(assistantProposals.photographerId, photographerId)));
  if (!card) return "There's no such card for this studio.";
  if (card.toolName !== name) return "That card is for a different action.";
  if (card.status !== "approved") return `That card is ${card.status}, not approved.`;
  if (card.expiresAt <= now) return "That card has expired.";
  if (card.argsHash !== hash) return "The details don't match what was approved.";
  return "That card can't run.";
}

const idList = z.array(z.uuid()).max(50);

// One recipient (or booking) as things stand right now.
type Target = { label: string; eligible: boolean; note?: string; run: () => Promise<boolean> };

// Who a card goes to, re-checked against the studio's data as it is now:
// still this studio's, still has an email, gallery still delivered or open,
// booking still confirmed and owing, and so on.
async function currentTargets(card: Card, effects: ActionEffects): Promise<Map<string, Target>> {
  const p = card.payload;
  const studio = card.photographerId;
  const targets = new Map<string, Target>();
  const skip = (label: string, note: string): Target => ({ label, eligible: false, note, run: async () => false });

  if (card.kind === "client_email") {
    const clientIds = idList.parse(p.clientIds);
    const subject = z.string().min(1).max(150).parse(p.subject);
    const body = z.string().min(1).max(5000).parse(p.message);
    const send = (name: string, email: string) =>
      effects.emailClient(studio, { name, email }, subject, body.replaceAll("{first_name}", firstName(name)));
    const rows = clientIds.length
      ? await db
          .select({ id: clients.id, name: clients.name, email: clients.email })
          .from(clients)
          .where(and(eq(clients.photographerId, studio), inArray(clients.id, clientIds)))
      : [];
    for (const id of clientIds) {
      const r = rows.find((row) => row.id === id);
      if (!r) targets.set(id, skip("A client who was removed", "No longer one of your clients."));
      else if (!r.email) targets.set(id, skip(r.name, "No email address."));
      else {
        const email = r.email;
        targets.set(id, { label: `${r.name} <${email}>`, eligible: true, run: () => send(r.name, email) });
      }
    }
    // People who weren't clients yet: added as clients only now, on approval
    // (never when the card was proposed), and only once.
    const newPeople = z
      .array(z.object({ name: z.string().min(1).max(120), email: z.email() }))
      .max(20)
      .catch([])
      .parse(p.newRecipients);
    for (const person of newPeople) {
      targets.set(`new:${person.email.toLowerCase()}`, {
        label: `${person.name} <${person.email}> (new client)`,
        eligible: true,
        run: async () => {
          const [existing] = await db
            .select({ name: clients.name, email: clients.email })
            .from(clients)
            .where(and(eq(clients.photographerId, studio), sql`lower(${clients.email}) = ${person.email.toLowerCase()}`))
            .limit(1);
          if (!existing) await db.insert(clients).values({ photographerId: studio, name: person.name, email: person.email });
          return send(existing?.name ?? person.name, existing?.email ?? person.email);
        },
      });
    }
  } else if (card.kind === "gallery_emails") {
    const kind = z.enum(["link", "closing_soon", "review_request"]).parse(p.kind);
    const galleryIds = idList.parse(p.galleryIds);
    const rows = await db
      .select({
        id: galleries.id,
        title: galleries.title,
        status: galleries.status,
        expiresAt: galleries.expiresAt,
        name: clients.name,
        email: clients.email,
      })
      .from(galleries)
      .leftJoin(clients, eq(clients.id, galleries.clientId))
      .where(and(eq(galleries.photographerId, studio), inArray(galleries.id, galleryIds)));
    const now = new Date();
    for (const id of galleryIds) {
      const r = rows.find((row) => row.id === id);
      if (!r) {
        targets.set(id, skip("A gallery that was removed", "No longer one of your galleries."));
        continue;
      }
      const label = `${r.title}: ${r.name ?? "no client"}${r.email ? ` <${r.email}>` : ""}`;
      const open = r.status !== "expired" && (r.expiresAt === null || r.expiresAt > now);
      if (!r.email) targets.set(id, skip(label, "The client has no email address."));
      else if (kind === "review_request" && r.status !== "delivered" && r.status !== "completed") targets.set(id, skip(label, "Not delivered."));
      else if (kind === "closing_soon" && (r.expiresAt === null || !open)) targets.set(id, skip(label, "Already closed, or no closing date."));
      else if (kind === "link" && !open) targets.set(id, skip(label, "The gallery has closed."));
      else targets.set(id, { label, eligible: true, run: () => effects.galleryEmail(kind, id) });
    }
  } else if (card.kind === "balance_reminders") {
    const bookingIds = idList.parse(p.bookingIds);
    const rows = await db
      .select({
        booking: bookings,
        paidCents: sql<number>`(select coalesce(sum(amount_cents), 0) from payments where payments.booking_id = bookings.id and payments.status = 'paid')::int`,
      })
      .from(bookings)
      .where(and(eq(bookings.photographerId, studio), inArray(bookings.id, bookingIds)));
    for (const id of bookingIds) {
      const r = rows.find((row) => row.booking.id === id);
      if (!r) {
        targets.set(id, skip("A booking that was removed", "No longer one of your bookings."));
        continue;
      }
      const due = bookingTotal(r.booking) - r.paidCents - prepaid(r.booking);
      const label = `${r.booking.clientName} · ${r.booking.sessionName}`;
      if (r.booking.status !== "confirmed") targets.set(id, skip(label, `The booking is ${r.booking.status}.`));
      else if (due <= 0) targets.set(id, skip(label, "Paid in full now."));
      else targets.set(id, { label: `${label}: ${formatPrice(due)} due`, eligible: true, run: () => effects.balanceReminder(id) });
    }
  } else if (card.kind === "booking_status") {
    const status = z.enum(["completed", "cancelled"]).parse(p.status);
    const bookingIds = idList.parse(p.bookingIds);
    const rows = await db
      .select({ id: bookings.id, status: bookings.status, clientName: bookings.clientName, sessionName: bookings.sessionName })
      .from(bookings)
      .where(and(eq(bookings.photographerId, studio), inArray(bookings.id, bookingIds)));
    for (const id of bookingIds) {
      const r = rows.find((row) => row.id === id);
      if (!r) targets.set(id, skip("A booking that was removed", "No longer one of your bookings."));
      else if (r.status === status || r.status === "cancelled") targets.set(id, skip(`${r.clientName} · ${r.sessionName}`, `Already ${r.status}.`));
      else targets.set(id, { label: `${r.clientName} · ${r.sessionName}`, eligible: true, run: () => effects.bookingStatus(id, status) });
    }
  }
  return targets;
}

// Carries out an approved card one recipient at a time, saving each result
// as it goes. On a retry, anyone already sent (or possibly sent) is never
// sent again; only pending and failed ones are tried, after re-checking.
async function runAction(card: Card, effects: ActionEffects): Promise<{ summary: string; complete: boolean; deliveries: ProposalDelivery[] }> {
  const targets = await currentTargets(card, effects);
  const deliveries: ProposalDelivery[] = (
    card.deliveries ??
    [...targets].map(
      ([key, t]): ProposalDelivery => ({ key, label: t.label, status: t.eligible ? "pending" : "skipped", ...(t.note ? { note: t.note } : {}) }),
    )
  ).map((d): ProposalDelivery =>
    // Started but never confirmed (the run was cut off): maybe sent, so never repeated.
    d.status === "sending" ? { ...d, status: "unknown", note: "Interrupted while sending. Check the Email log." } : { ...d },
  );
  const save = () =>
    db
      .update(assistantProposals)
      .set({ deliveries: deliveries.map((d) => ({ ...d })) })
      .where(eq(assistantProposals.id, card.id));
  await save();

  for (const d of deliveries) {
    if (d.status !== "pending" && d.status !== "failed") continue;
    const target = targets.get(d.key);
    if (!target?.eligible) {
      d.status = "skipped";
      d.note = target?.note ?? "No longer qualifies.";
      await save();
      continue;
    }
    d.status = "sending";
    delete d.note;
    await save();
    try {
      const ok = await target.run();
      d.status = ok ? "sent" : "failed";
      if (!ok) d.note = "Couldn't be sent.";
    } catch (error) {
      d.status = "unknown";
      d.note = "Something went wrong while sending. Check the Email log.";
      await save();
      throw error;
    }
    await save();
  }
  return { ...summarize(card.kind, deliveries), deliveries };
}

// "Sent 2 of 3. 1 couldn't be sent." from the per-recipient results.
export function summarize(kind: Card["kind"], deliveries: ProposalDelivery[]): { summary: string; complete: boolean } {
  const n = (status: ProposalDelivery["status"]) => deliveries.filter((d) => d.status === status).length;
  const sent = n("sent");
  const failed = n("failed");
  const unknown = n("unknown") + n("sending");
  const skipped = n("skipped");
  const pending = n("pending");
  const total = deliveries.length - skipped;
  const parts = [
    kind === "booking_status"
      ? `Updated ${sent} of ${total}.`
      : !process.env.SMTP_HOST
        ? `Done (${sent} of ${total}). Email isn't sent from this computer; see the Email log.`
        : `Sent ${sent} of ${total}.`,
    failed ? `${failed} couldn't be ${kind === "booking_status" ? "changed" : "sent"}.` : "",
    unknown ? `${unknown} may not have gone through; check the Email log.` : "",
    pending ? `${pending} not tried yet.` : "",
    skipped ? `Skipped ${skipped} that no longer qualified.` : "",
  ];
  return { summary: parts.filter(Boolean).join(" "), complete: failed + unknown + pending === 0 };
}

// ---- The Approve and Try again buttons ------------------------------------

export type CardOutcome = { ok: boolean; message: string; status?: Card["status"]; deliveries?: ProposalDelivery[] | null };

async function runDecided(card: Card, timeZone: string, effects: ActionEffects, now: Date): Promise<CardOutcome> {
  let message: string;
  let ok = true;
  try {
    const run = await executeTool(
      card.toolName,
      card.payload,
      { photographerId: card.photographerId, timeZone },
      { pendingActionId: card.id, effects, now },
    );
    message = run.text;
    ok = run.complete !== false;
  } catch (error) {
    ok = false;
    message = error instanceof ActionRefusedError ? error.message : "Something went wrong part way through. Who got it so far is listed below.";
  }
  const [latest] = await db
    .select({ status: assistantProposals.status, result: assistantProposals.result, deliveries: assistantProposals.deliveries })
    .from(assistantProposals)
    .where(eq(assistantProposals.id, card.id));
  return { ok, message: ok ? message : (latest?.result ?? message), status: latest?.status, deliveries: latest?.deliveries };
}

// Approve: decide, then run.
export async function approveAndRun(
  proposalId: string,
  photographerId: string,
  timeZone: string,
  effects: ActionEffects,
  now = new Date(),
): Promise<CardOutcome> {
  const decision = await decideAction(proposalId, photographerId, "approve", now);
  if (!decision.ok) {
    return {
      ok: false,
      message:
        decision.reason === "expired"
          ? "This card expired (cards last 24 hours). Nothing was sent. Ask the Assistant to prepare it again."
          : decision.reason === "not_found"
            ? "That card could not be found."
            : "This was already approved or dismissed.",
    };
  }
  return runDecided(decision.card, timeZone, effects, now);
}

// A run that stopped part way ("failed", or stuck "executing" this long) can
// be tried again for the people who didn't get it.
export const STUCK_RUN_MS = 10 * 60 * 1000;

// Try again: the photographer's click puts a failed card back to approved,
// then it runs for whoever is still pending or failed. Never past 24 hours.
export async function retryAndRun(
  proposalId: string,
  photographerId: string,
  timeZone: string,
  effects: ActionEffects,
  now = new Date(),
): Promise<CardOutcome> {
  if (!z.uuid().safeParse(proposalId).success) return { ok: false, message: "That card could not be found." };
  const [card] = await db
    .update(assistantProposals)
    .set({ status: "approved", decidedAt: now, decidedBy: photographerId })
    .where(
      and(
        eq(assistantProposals.id, proposalId),
        eq(assistantProposals.photographerId, photographerId),
        gt(assistantProposals.expiresAt, now),
        or(
          eq(assistantProposals.status, "failed"),
          and(eq(assistantProposals.status, "executing"), lt(assistantProposals.runStartedAt, new Date(now.getTime() - STUCK_RUN_MS))),
        ),
      ),
    )
    .returning();
  if (!card) {
    const [existing] = await db
      .select({ status: assistantProposals.status, expiresAt: assistantProposals.expiresAt })
      .from(assistantProposals)
      .where(and(eq(assistantProposals.id, proposalId), eq(assistantProposals.photographerId, photographerId)));
    if (!existing) return { ok: false, message: "That card could not be found." };
    if (existing.expiresAt <= now) return { ok: false, message: "This card expired (cards last 24 hours). Ask the Assistant to prepare it again." };
    return { ok: false, message: existing.status === "executing" ? "It's still running. Give it a few minutes." : "There's nothing left to try again." };
  }
  await addLateStep(card.traceId, photographerId, "approval_decided", { toolName: card.toolName, toolOutput: "retry approved" });
  return runDecided(card, timeZone, effects, now);
}
