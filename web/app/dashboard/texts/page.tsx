import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers, smsLog } from "@/db/schema";
import { formatDate, formatTime } from "@/lib/booking/time";
import { formatPhone } from "@/lib/sms/phone";
import { requirePhotographer } from "@/lib/session";
import { STATUS_STYLES, kindLabel } from "../emails/labels";

export const metadata = { title: "Text log · PhotoEZ Cloud" };

const SHOWN = 200;
const TEXT_KINDS: Record<string, string> = { test: "Test text", booking_new: "New booking (to you)", inquiry_new: "New inquiry (to you)" };

// Every text the studio's Twilio account sent (or tried to), newest first.
export default async function TextLogPage() {
  const user = await requirePhotographer();
  const [studio] = await db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, user.id));
  const texts = await db
    .select()
    .from(smsLog)
    .where(eq(smsLog.photographerId, user.id))
    .orderBy(desc(smsLog.createdAt))
    .limit(SHOWN);

  return (
    <div>
      <Link href="/dashboard/settings#texts" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Settings
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Text log</h1>
      <p className="mt-2 text-muted">
        Every text sent through your Twilio account, newest first{texts.length === SHOWN ? ` (the last ${SHOWN})` : ""}.
      </p>

      {texts.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-muted">No texts yet. They&apos;ll show up here as they go out.</div>
      ) : (
        <ul className="card mt-8 divide-y divide-border overflow-hidden">
          {texts.map((t) => {
            const status = STATUS_STYLES[t.status];
            return (
              <li key={t.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-4">
                <span className="w-40 shrink-0 text-sm text-muted">
                  {formatDate(t.createdAt, studio.timeZone, "short")}
                  <br className="hidden sm:block" /> {formatTime(t.createdAt, studio.timeZone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold tracking-wider text-muted uppercase">{TEXT_KINDS[t.kind] ?? kindLabel(t.kind)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${status.className}`}>{status.label}</span>
                    <span className="text-sm font-semibold">{formatPhone(t.toPhone)}</span>
                  </span>
                  <span className="mt-1 block text-sm break-words">{t.body}</span>
                  {t.error && <span className="mt-1 block text-xs font-medium text-danger">{t.error}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
