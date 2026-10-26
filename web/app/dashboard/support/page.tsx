import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportMessages } from "@/db/schema";
import { requireOwner } from "@/lib/owner";
import { ROLE_LABELS, topicLabel } from "@/lib/support";
import { setSupportStatus } from "./actions";

export const metadata = { title: "Support inbox · PhotoEZ Cloud" };

// The owner's list of messages from the Support page (/support), newest
// first. Each one was emailed too; this is where none get lost.
export default async function SupportInboxPage({ searchParams }: PageProps<"/dashboard/support">) {
  await requireOwner();
  const status = (await searchParams).show === "done" ? "done" : "new";
  const rows = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.status, status))
    .orderBy(desc(supportMessages.createdAt))
    .limit(200);
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const filter = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-bold tracking-wider uppercase ${active ? "bg-brand text-white" : "bg-surface text-muted hover:text-foreground"}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Support inbox</h1>
          <p className="mt-2 text-muted">
            Messages from the{" "}
            <Link href="/support" className="link">
              Support page
            </Link>
            , from photographers and their clients. Each is also emailed to you; reply there or with the button below.
            Only you see this page.
          </p>
        </div>
        <nav className="flex gap-2">
          <Link href="/dashboard/support" className={filter(status === "new")}>
            New
          </Link>
          <Link href="/dashboard/support?show=done" className={filter(status === "done")}>
            Done
          </Link>
        </nav>
      </div>

      {rows.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-muted">
          {status === "new" ? "No new messages. You're all caught up." : "Nothing marked done yet."}
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {rows.map((m) => (
            <li key={m.id} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {m.name} <span className="font-normal text-muted">· {m.email}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2 text-sm">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase ${
                        m.role === "client" ? "bg-sky-light/60 text-brand-deep" : "bg-lime/25 text-lime-ink"
                      }`}
                    >
                      {ROLE_LABELS[m.role]}
                    </span>
                    <span className="text-muted">{topicLabel(m.role, m.topic) ?? m.topic}</span>
                    {m.studio && <span className="text-muted">· {m.studio}</span>}
                  </p>
                </div>
                <span className="text-sm text-muted">{when.format(m.createdAt)}</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap">{m.message}</p>
              {(m.pageUrl || m.userAgent) && (
                <dl className="mt-4 space-y-1 text-xs text-muted">
                  {m.pageUrl && (
                    <div className="break-all">
                      <dt className="inline font-semibold">Page: </dt>
                      <dd className="inline">{m.pageUrl}</dd>
                    </div>
                  )}
                  {m.userAgent && (
                    <div className="break-all">
                      <dt className="inline font-semibold">Browser: </dt>
                      <dd className="inline">{m.userAgent}</dd>
                    </div>
                  )}
                </dl>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your PhotoEZ Cloud message")}`}
                  className="btn-secondary"
                >
                  Reply by email
                </a>
                <form action={setSupportStatus.bind(null, m.id, status === "new" ? "done" : "new")}>
                  <button type="submit" className="btn-secondary">
                    {status === "new" ? "Mark done" : "Move back to new"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
