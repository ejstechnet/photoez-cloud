import Link from "next/link";
import { DownloadIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { inputClass } from "@/components/form";
import { GROWTH_STATUSES, GROWTH_TIERS, type GrowthStatus, type GrowthTier } from "@/lib/growth/constants";
import { QUEUE_SORTS, ensureGrowthSeeded, listOpportunities, listSources, type QueueFilters } from "@/lib/growth/opportunities";
import { STATUS_LABELS } from "@/lib/growth/pipeline";
import { growthBudget } from "@/lib/growth/budget";
import { bookmarkletCode } from "@/lib/growth/capture";
import { requireOwner } from "@/lib/owner";
import { siteUrl } from "@/lib/site";
import { BookmarkInstaller } from "./bookmark-installer";
import { PLATFORM_LABELS, STATUS_STYLES, TIER_LABELS, TIER_STYLES, badge } from "./labels";

export const metadata = { title: "Growth · PhotoEZ Cloud" };

const SORT_LABELS = { newest: "Newest first", score: "Highest score", next_action: "Next follow-up" } as const;

// Reads the queue's filters from the address bar, ignoring anything unknown.
function filtersFrom(params: Record<string, string | string[] | undefined>): QueueFilters {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const status = one("status");
  const tier = one("tier");
  const sort = one("sort");
  return {
    q: one("q").slice(0, 200),
    status: (GROWTH_STATUSES as readonly string[]).includes(status) || status === "all" ? (status as GrowthStatus | "all") : "active",
    tier: (GROWTH_TIERS as readonly string[]).includes(tier) || tier === "unscored" ? (tier as GrowthTier | "unscored") : undefined,
    sourceId: /^[0-9a-f-]{36}$/i.test(one("source")) ? one("source") : undefined,
    sort: (QUEUE_SORTS as readonly string[]).includes(sort) ? (sort as QueueFilters["sort"]) : "newest",
  };
}

// The owner's Growth queue (GrowthPilot): public posts where photographers
// talk about studio software, to review, reply to by hand, and follow.
export default async function GrowthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  await ensureGrowthSeeded();
  const filters = filtersFrom(await searchParams);
  const [rows, sources, budget] = await Promise.all([listOpportunities(filters), listSources(), growthBudget()]);
  const dollars = (micro: number) => `$${(micro / 1_000_000).toFixed(2)}`;
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const filtered = Boolean(filters.q || filters.tier || filters.sourceId || filters.status !== "active");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-wider text-coral uppercase">
            {rows.length === 1 ? "1 post" : `${rows.length} posts`}
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Growth</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Posts where photographers ask about studio software. Review them, reply by hand, and track what happens. Only
            you see this.
          </p>
          <p className="mt-1 text-sm text-muted">
            {budget.on
              ? `AI this month: ${dollars(budget.spent)} of ${dollars(budget.cap)}${budget.canSpend ? "" : " (used up: scoring paused)"}`
              : "AI scoring is off (no monthly cap set)."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/growth/csv" className="btn-secondary" prefetch={false}>
            <DownloadIcon size={18} /> Spreadsheet
          </Link>
          <Link href="/dashboard/growth/new" className="btn-primary">
            <PlusIcon size={18} /> Add a post
          </Link>
        </div>
      </div>

      <BookmarkInstaller code={bookmarkletCode(siteUrl)} />

      <form className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]" role="search">
        <label className="block">
          <span className="sr-only">Search</span>
          <input name="q" defaultValue={filters.q} placeholder="Search text, link or name" className={inputClass} />
        </label>
        <select name="status" defaultValue={filters.status} aria-label="Status" className={inputClass}>
          <option value="active">Open posts</option>
          <option value="all">All posts</option>
          {GROWTH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="tier" defaultValue={filters.tier ?? ""} aria-label="Priority" className={inputClass}>
          <option value="">Any priority</option>
          {GROWTH_TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
          <option value="unscored">Not scored yet</option>
        </select>
        <select name="source" defaultValue={filters.sourceId ?? ""} aria-label="Source" className={inputClass}>
          <option value="">Any source</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={filters.sort} aria-label="Sort" className={inputClass}>
          {QUEUE_SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          <SearchIcon size={18} /> Show
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center border-2 border-dashed px-6 py-14 text-center">
          <p className="font-display text-2xl font-bold">{filtered ? "Nothing matches" : "No posts yet"}</p>
          <p className="mt-2 max-w-md text-muted">
            {filtered
              ? "Try fewer filters, or show all posts."
              : "When you see a photographer asking about galleries, booking or Pixieset alternatives, save the post here."}
          </p>
          {filtered ? (
            <Link href="/dashboard/growth" className="btn-secondary mt-6">
              Clear filters
            </Link>
          ) : (
            <Link href="/dashboard/growth/new" className="btn-primary mt-6">
              <PlusIcon size={18} /> Add a post
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/growth/${r.id}`}
                className="card group flex flex-col gap-3 px-5 py-4 transition hover:-translate-y-0.5 hover:border-lime hover:shadow-lg sm:flex-row sm:items-center"
              >
                <div className="flex shrink-0 items-center gap-2 sm:w-40 sm:flex-col sm:items-start">
                  <span className={`${badge} ${STATUS_STYLES[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                  {r.tier ? (
                    <span className={`${badge} ${TIER_STYLES[r.tier]}`}>
                      {r.score} · {TIER_LABELS[r.tier]}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">Not scored</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.title || r.excerpt || r.url}</p>
                  {r.title && r.excerpt && <p className="line-clamp-2 text-sm text-foreground/80">{r.excerpt}</p>}
                  <p className="mt-1 truncate text-xs text-muted">
                    {[PLATFORM_LABELS[r.platform], r.sourceName, r.authorLabel, `saved ${day.format(r.discoveredAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                    {r.nextActionAt && ` · follow up ${day.format(r.nextActionAt)}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
