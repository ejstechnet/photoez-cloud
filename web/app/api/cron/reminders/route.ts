import { timingSafeEqual } from "node:crypto";
import { expireProposals } from "@/lib/ai/assistant/executor";
import { pruneTraces } from "@/lib/ai/assistant/trace";
import { runReminders } from "@/lib/email/reminders";

// Called by the server's cron every 15 minutes:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3002/api/cron/reminders
// CRON_SECRET (in web/.env) keeps anyone else from triggering it.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET isn't set." }, { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Not allowed." }, { status: 401 });
  }

  const sent = await runReminders();
  // Studio Assistant housekeeping: cards past 24 hours expire; step logs
  // older than AI_TRACE_KEEP_DAYS (90) are deleted.
  const expiredCards = await expireProposals().catch((e) => (console.error("Expiring assistant cards failed", e), 0));
  const prunedTraces = await pruneTraces().catch((e) => (console.error("Pruning AI traces failed", e), 0));
  return Response.json({ ok: true, sent, expiredCards, prunedTraces });
}
