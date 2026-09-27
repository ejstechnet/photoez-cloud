import { timingSafeEqual } from "node:crypto";
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
  return Response.json({ ok: true, sent });
}
