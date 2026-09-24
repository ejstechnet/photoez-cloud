import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { ArrowRightIcon, InboxIcon, PlusIcon, SparklesIcon } from "@/components/icons";
import { requirePhotographer } from "@/lib/session";
import { SESSION_LABELS, STATUS_STYLES, formatEventDate } from "./labels";

export default async function InquiriesPage() {
  const user = await requirePhotographer();
  const rows = await db
    .select()
    .from(inquiries)
    .where(eq(inquiries.photographerId, user.id))
    .orderBy(desc(inquiries.createdAt));
  const newCount = rows.filter((row) => row.status === "new").length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-wider text-coral uppercase">
            {newCount === 1 ? "1 new inquiry" : `${newCount} new inquiries`}
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Inquiries</h1>
        </div>
        <Link href="/dashboard/inquiries/new" className="btn-primary">
          <PlusIcon size={18} /> New inquiry
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-10 flex flex-col items-center border-2 border-dashed px-6 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-coral text-brand-deep">
            <InboxIcon size={28} />
          </span>
          <p className="mt-5 font-display text-2xl font-bold">Triage your first inquiry</p>
          <p className="mt-2 max-w-md text-muted">
            Paste an inquiry email and the AI pulls out the session, date, budget, and questions, then drafts a reply in
            your voice.
          </p>
          <Link href="/dashboard/inquiries/new" className="btn-primary mt-6">
            New inquiry <ArrowRightIcon size={18} />
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-3">
          {rows.map((inquiry) => {
            const t = inquiry.triage;
            const status = STATUS_STYLES[inquiry.status];
            const when = t ? formatEventDate(t) : null;
            return (
              <li key={inquiry.id}>
                <Link
                  href={`/dashboard/inquiries/${inquiry.id}`}
                  className="card group flex flex-col gap-3 px-5 py-4 transition hover:-translate-y-0.5 hover:border-lime hover:shadow-lg sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase ${status.className}`}>
                        {status.label}
                      </span>
                      {t && (
                        <span className="rounded-full bg-violet/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-violet uppercase">
                          {SESSION_LABELS[t.sessionType]}
                        </span>
                      )}
                      <span className="text-xs text-muted">
                        {inquiry.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate font-semibold">
                      {t?.clientName ?? inquiry.fromName ?? inquiry.fromEmail ?? "Unknown sender"}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {t ? t.summary : inquiry.triageError ? "Triage didn't finish. Open to try again." : inquiry.message}
                    </p>
                  </div>
                  {when && (
                    <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-lime-ink">
                      <SparklesIcon size={16} /> {when}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
