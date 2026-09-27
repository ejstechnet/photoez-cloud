import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { emailLog, photographers } from "@/db/schema";
import { formatDate, formatTime } from "@/lib/booking/time";
import { requirePhotographer } from "@/lib/session";
import { STATUS_STYLES, kindLabel } from "./labels";

export const metadata = { title: "Email log · PhotoEZ Cloud" };

const SHOWN = 200;

// Every email the studio's account sent, newest first (PhotoEZ Booking's email log).
export default async function EmailLogPage() {
  const user = await requirePhotographer();
  const [studio] = await db
    .select({ timeZone: photographers.timeZone })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const emails = await db
    .select({
      id: emailLog.id,
      kind: emailLog.kind,
      toEmail: emailLog.toEmail,
      subject: emailLog.subject,
      status: emailLog.status,
      createdAt: emailLog.createdAt,
    })
    .from(emailLog)
    .where(eq(emailLog.photographerId, user.id))
    .orderBy(desc(emailLog.createdAt))
    .limit(SHOWN);

  return (
    <div>
      <Link href="/dashboard/settings#email" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Settings
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">Email log</h1>
      <p className="mt-2 text-muted">
        Every email sent to your clients and to you, newest first{emails.length === SHOWN ? ` (the last ${SHOWN})` : ""}.
      </p>

      {emails.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-muted">No emails yet. They&apos;ll show up here as they go out.</div>
      ) : (
        <ul className="card mt-8 divide-y divide-border overflow-hidden">
          {emails.map((email) => {
            const status = STATUS_STYLES[email.status];
            return (
              <li key={email.id}>
                <Link
                  href={`/dashboard/emails/${email.id}`}
                  className="flex flex-col gap-1 px-5 py-4 transition hover:bg-background sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="w-40 shrink-0 text-sm text-muted">
                    {formatDate(email.createdAt, studio.timeZone, "short")}
                    <br className="hidden sm:block" /> {formatTime(email.createdAt, studio.timeZone)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{email.subject}</span>
                    <span className="block truncate text-sm text-muted">
                      {kindLabel(email.kind)} · to {email.toEmail}
                    </span>
                  </span>
                  <span
                    className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase sm:self-center ${status.className}`}
                  >
                    {status.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
