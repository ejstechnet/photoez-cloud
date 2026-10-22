import Link from "next/link";
import { DEFAULT_DISCLOSURE } from "@/lib/growth/constants";
import { FEED_EVERY_HOURS } from "@/lib/growth/discover";
import { ensureGrowthSeeded } from "@/lib/growth/opportunities";
import { listKeywords, sourcesWithLastRun, type SourceInput } from "@/lib/growth/sources";
import { requireOwner } from "@/lib/owner";
import { PLATFORM_LABELS, badge } from "../labels";
import { Phrases } from "./phrases";
import { SourceForm } from "./source-form";

export const metadata = { title: "Sources & phrases · Growth · PhotoEZ Cloud" };

const blank = (kind: "rss" | "manual"): SourceInput => ({
  name: "",
  platform: kind === "rss" ? "web" : "facebook",
  kind,
  feedUrl: "",
  searchUrl: "",
  filter: "none",
  enabled: true,
  linksAllowed: false,
  selfPromoAllowed: false,
  disclosure: DEFAULT_DISCLOSURE,
  rulesNote: "",
});

// Where Growth finds posts: Google Alerts feeds it reads by itself, searches
// and communities Elle uses herself (with their rules), and the phrases.
export default async function SourcesPage() {
  await requireOwner();
  await ensureGrowthSeeded();
  const [sources, phrases] = await Promise.all([sourcesWithLastRun(), listKeywords()]);
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const feeds = sources.filter((s) => s.kind === "rss");
  const others = sources.filter((s) => s.kind !== "rss");

  const editable = (s: (typeof sources)[number]): SourceInput => ({
    name: s.name,
    platform: s.platform,
    kind: s.kind === "rss" ? "rss" : "manual",
    feedUrl: s.config.feedUrl ?? "",
    searchUrl: s.config.searchUrl ?? "",
    filter: s.config.filter === "keywords" ? "keywords" : "none",
    enabled: s.enabled,
    linksAllowed: s.linksAllowed,
    selfPromoAllowed: s.selfPromoAllowed,
    disclosure: s.disclosure,
    rulesNote: s.rulesNote ?? "",
  });

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/growth" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Growth
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Sources &amp; phrases</h1>
      <p className="mt-2 text-muted">
        Feeds are read automatically every {FEED_EVERY_HOURS} hours, and new posts are scored and drafted for you. Facebook groups
        can&apos;t be read automatically, so those are searches you run with one click.
      </p>

      <section className="card mt-8 p-6">
        <h2 className="font-display text-2xl font-bold">Find posts automatically (Google Alerts)</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          <li>
            Go to{" "}
            <a href="https://www.google.com/alerts" target="_blank" rel="noopener noreferrer" className="link font-semibold">
              google.com/alerts
            </a>{" "}
            and type a phrase, in quotes, like &ldquo;how do you deliver photos to clients&rdquo;.
          </li>
          <li>
            Click <strong>Show options</strong>. Set <strong>How many</strong> to <strong>All results</strong> and{" "}
            <strong>Deliver to</strong> to <strong>RSS feed</strong>, then <strong>Create Alert</strong>.
          </li>
          <li>Next to the new alert, right-click the orange RSS icon and choose <strong>Copy link address</strong>.</li>
          <li>Paste it below as a new feed. Repeat for each phrase that matters most.</li>
        </ol>
        <div className="mt-6 rounded-xl bg-background p-5">
          <h3 className="font-semibold">Add a feed</h3>
          <div className="mt-4">
            <SourceForm id={null} initial={blank("rss")} submitLabel="Add feed" />
          </div>
        </div>
        {feeds.length > 0 && (
          <ul className="mt-6 space-y-3">
            {feeds.map((s) => (
              <li key={s.id}>
                <details className="rounded-xl border-2 border-border p-4">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    {!s.enabled && <span className={`${badge} bg-border text-muted`}>Off</span>}
                    {s.lastRun?.status === "error" && <span className={`${badge} bg-danger/15 text-danger`}>Last read failed</span>}
                    <span className="text-sm text-muted">
                      {s.lastRun
                        ? `Read ${when.format(s.lastRun.startedAt)}: ${s.lastRun.found} items, ${s.lastRun.saved} new, ${s.lastRun.kept} kept`
                        : "Not read yet: within 15 minutes"}
                    </span>
                  </summary>
                  {s.lastRun?.error && <p className="mt-3 text-sm text-danger">{s.lastRun.error}</p>}
                  <div className="mt-4">
                    <SourceForm id={s.id} initial={editable(s)} submitLabel="Save" />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-8 p-6">
        <h2 className="font-display text-2xl font-bold">Searches and communities you use yourself</h2>
        <p className="mt-2 text-sm text-muted">
          Facebook groups and searches. Their rules shape every draft for posts saved from them. A search link shows as a
          one-click button on the Growth page.
        </p>
        <ul className="mt-4 space-y-3">
          {others.map((s) => (
            <li key={s.id}>
              <details className="rounded-xl border-2 border-border p-4">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-sm text-muted">
                    {PLATFORM_LABELS[s.platform]} · {s.linksAllowed ? "links OK" : "no links"} · {s.selfPromoAllowed ? "self-promo OK" : "no self-promo"}
                  </span>
                </summary>
                <div className="mt-4">
                  <SourceForm id={s.id} initial={editable(s)} submitLabel="Save" />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <details className="mt-6 rounded-xl bg-background p-5">
          <summary className="cursor-pointer font-semibold">Add a group or search</summary>
          <div className="mt-4">
            <SourceForm id={null} initial={blank("manual")} submitLabel="Add" />
          </div>
        </details>
      </section>

      <section className="card mt-8 p-6">
        <h2 className="font-display text-2xl font-bold">Phrases</h2>
        <p className="mt-2 text-sm text-muted">
          The questions photographers ask. Make a Google Alert for the ones that matter most; feeds of every new thread are
          filtered by these.
        </p>
        <div className="mt-4">
          <Phrases phrases={phrases} />
        </div>
      </section>
    </div>
  );
}
