import { requireOwner } from "@/lib/owner";
import { NO_TAG, bySource, signupTotals } from "@/lib/signup-stats";
import { allSignups } from "@/lib/signups";
import { describeAnswers } from "@/lib/quiz";

export const metadata = { title: "Sign-ups · PhotoEZ Cloud" };

const STATUS_STYLES: Record<string, string> = {
  "Pro trial": "bg-lime/25 text-lime-ink",
  Free: "bg-border text-muted",
  Pro: "bg-violet/20 text-violet",
  Studio: "bg-coral/20 text-coral",
  "No account": "bg-sun/30 text-brand-deep",
};

// The owner's view of every studio that has signed up: totals, how many came
// from each tagged link (photoezcloud.com/join?src=<tag>) or none, and who
// confirmed their email, is trying Pro, or now pays.
export default async function SignupsPage() {
  await requireOwner();
  const rows = await allSignups();
  const totals = signupTotals(rows);
  const tags = bySource(rows.filter((r) => r.hasAccount));
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

  const tiles = [
    { label: "Studios", value: totals.studios, note: "signed up" },
    { label: "Confirmed", value: totals.confirmed, note: "clicked the email link" },
    { label: "On Pro trial", value: totals.onTrial, note: "trying Pro now" },
    { label: "Paying", value: totals.paying, note: "on Pro or Studio" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Sign-ups</h1>
          <p className="mt-2 text-muted">
            Every studio that has signed up, newest first. &ldquo;{NO_TAG}&rdquo; means they came from a plain link, not a
            tagged one like <code>photoezcloud.com/join?src=facebook</code>. Only you see this page.
          </p>
        </div>
        {rows.length > 0 && (
          <a href="/dashboard/signups/csv" className="btn-secondary">
            Download spreadsheet
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-muted">No sign-ups yet. New studios show up here the moment they join.</div>
      ) : (
        <>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <li key={t.label} className="card p-5">
                <p className="text-sm font-bold tracking-wider text-muted uppercase">{t.label}</p>
                <p className="mt-1 font-display text-4xl font-bold">{t.value}</p>
                <p className="text-sm text-muted">{t.note}</p>
              </li>
            ))}
          </ul>

          {tags.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-2xl font-bold">By link</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tags.map((t) => (
                  <li key={t.source} className="card p-5">
                    <p className="text-sm font-bold tracking-wider text-muted uppercase">{t.source}</p>
                    <p className="mt-1 font-display text-3xl font-bold">{t.signups}</p>
                    <p className="text-sm text-muted">
                      sign-up{t.signups === 1 ? "" : "s"} · {t.paying} paying
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <ul className="card mt-10 divide-y divide-border overflow-hidden">
            {rows.map((r) => (
              <li key={r.email} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                <span className="w-32 shrink-0 text-sm text-muted">{day.format(r.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.businessName || r.name || r.email}</span>
                  <span className="block truncate text-sm text-muted">
                    {r.email} · {r.source ?? NO_TAG}
                  </span>
                  {r.quiz && <span className="mt-1 block text-sm text-foreground/80">Quiz: {describeAnswers(r.quiz)}</span>}
                </span>
                <span className="flex flex-wrap gap-2 self-start sm:self-center">
                  {r.hasAccount && !r.emailVerified && (
                    <span className="rounded-full bg-sun/30 px-2.5 py-1 text-[11px] font-bold tracking-wider text-brand-deep uppercase">
                      Email not confirmed
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${STATUS_STYLES[r.status] ?? ""}`}
                  >
                    {r.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
