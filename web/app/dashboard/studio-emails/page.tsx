import Link from "next/link";
import { requireOwner } from "@/lib/owner";
import { EMAIL_LOGO, ensureStarterTemplates, listStudios, listTemplates, sendHistory } from "@/lib/studio-emails-server";
import { resumeSend } from "./actions";
import { Composer } from "./composer";

export const metadata = { title: "Email studios · PhotoEZ Cloud" };

// The owner's page for emailing PhotoEZ Cloud's photographers: welcomes,
// check-ins, announcements. Only the owner sees it (Settings > Email studios).
export default async function StudioEmailsPage() {
  await requireOwner();
  await ensureStarterTemplates();
  const [studios, templates, history] = await Promise.all([listStudios(), listTemplates(), sendHistory()]);
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Email studios</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Write to the photographers on PhotoEZ Cloud with your logo at the top. Replies come to your inbox, every email has
        an unsubscribe link, and big sends go out a few at a time to keep your email trusted. Only you see this page.
      </p>

      <div className="mt-8">
        <Composer
          studios={studios}
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            heading: t.heading,
            body: t.body,
            buttonLabel: t.buttonLabel,
            buttonUrl: t.buttonUrl,
          }))}
          logo={EMAIL_LOGO}
        />
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Sent</h2>
        {history.length === 0 ? (
          <div className="card mt-4 p-8 text-center text-muted">Nothing sent yet. Your sends will show up here.</div>
        ) : (
          <ul className="card mt-4 divide-y divide-border overflow-hidden">
            {history.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-36 shrink-0 text-sm text-muted">{when.format(s.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.subject}</span>
                  <span className="block text-sm text-muted">
                    {s.templateName ? `From "${s.templateName}" · ` : ""}
                    {s.sent} of {s.total} sent
                    {s.failed > 0 && ` · ${s.failed} didn't go through`}
                    {s.skipped > 0 && ` · ${s.skipped} skipped (unsubscribed)`}
                  </span>
                </span>
                {s.pending > 0 ? (
                  <span className="flex items-center gap-3">
                    <span className="rounded-full bg-sun/30 px-2.5 py-1 text-[11px] font-bold tracking-wider text-brand-deep uppercase">
                      {s.pending} waiting
                    </span>
                    {/* After a restart (like an update), the rest wait until Resume. */}
                    <form action={resumeSend.bind(null, s.id)}>
                      <button type="submit" className="text-xs font-bold tracking-wider text-link uppercase hover:underline">
                        Resume
                      </button>
                    </form>
                  </span>
                ) : (
                  <span className="rounded-full bg-lime/25 px-2.5 py-1 text-[11px] font-bold tracking-wider text-lime-ink uppercase">
                    Done
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted">
          Each email is also in your{" "}
          <Link href="/dashboard/emails" className="link">
            Email log
          </Link>
          , with the reason if one didn&rsquo;t go through.
        </p>
      </section>
    </div>
  );
}
