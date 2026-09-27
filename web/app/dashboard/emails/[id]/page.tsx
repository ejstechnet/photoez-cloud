import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { emailLog, photographers } from "@/db/schema";
import { formatDate, formatTime } from "@/lib/booking/time";
import { requirePhotographer } from "@/lib/session";
import { STATUS_STYLES, kindLabel } from "../labels";

// One email from the log, shown exactly as it was sent.
export default async function EmailPage({ params }: PageProps<"/dashboard/emails/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [email] = await db
    .select()
    .from(emailLog)
    .where(and(eq(emailLog.id, id), eq(emailLog.photographerId, user.id)));
  if (!email) notFound();
  const [studio] = await db
    .select({ timeZone: photographers.timeZone })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const status = STATUS_STYLES[email.status];

  const related = email.bookingId
    ? { href: `/dashboard/bookings/${email.bookingId}`, label: "Open booking" }
    : email.galleryId
      ? { href: `/dashboard/galleries/${email.galleryId}`, label: "Open gallery" }
      : email.inquiryId
        ? { href: `/dashboard/inquiries/${email.inquiryId}`, label: "Open inquiry" }
        : null;

  return (
    <div>
      <Link href="/dashboard/emails" className="text-sm font-semibold text-muted hover:text-foreground">
        ← Email log
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">{email.subject}</h1>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${status.className}`}>
          {status.label}
        </span>
      </div>
      <p className="mt-2 text-muted">
        {kindLabel(email.kind)} · to <strong className="text-foreground">{email.toEmail}</strong> ·{" "}
        {formatDate(email.createdAt, studio.timeZone)} at {formatTime(email.createdAt, studio.timeZone)}
        {related && (
          <>
            {" · "}
            <Link href={related.href} className="link">
              {related.label}
            </Link>
          </>
        )}
      </p>
      {email.error && email.status !== "sent" && (
        <p className="mt-4 rounded-xl bg-sun/25 px-4 py-3 text-sm">
          <strong>{email.status === "failed" ? "Why it failed:" : "Why it wasn't sent:"}</strong> {email.error}
        </p>
      )}

      {/* Sandboxed: the email can't run scripts or reach this page. */}
      <iframe
        title="Email as sent"
        // Links open in a new tab instead of inside the preview.
        srcDoc={email.html.replace("<head>", '<head><base target="_blank">')}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        className="card mt-6 h-[75vh] w-full overflow-hidden bg-white"
      />
    </div>
  );
}
