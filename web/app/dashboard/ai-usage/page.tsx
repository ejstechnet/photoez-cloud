import Link from "next/link";
import { costReport, currentMonth, dollars, REPORT_TIME_ZONE } from "@/lib/ai/cost-report";
import { formatPrice } from "@/lib/booking/format";
import { inputClass } from "@/components/form";
import { requireOwner } from "@/lib/owner";
import { FEATURE_LABELS, SORTS, sortStudios, UNIT_LABELS, type StudioSort } from "./labels";

export const metadata = { title: "AI usage · PhotoEZ Cloud" };

const PLAN_LABELS: Record<string, string> = { free: "Free", pro: "Pro", studio: "Studio" };
const calls = (n: number, word = "call") => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

// The owner's AI cost report: what AI cost this month, by feature, model,
// day and studio (lib/ai/cost-report.ts). Only the owner sees it.
export default async function AiUsagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  const params = await searchParams;
  const asked = typeof params.month === "string" ? params.month : "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(asked) ? asked : currentMonth();
  const sort: StudioSort = SORTS.includes(params.sort as StudioSort) ? (params.sort as StudioSort) : "cost";
  const report = await costReport(month);
  const studios = sortStudios(report.studios, sort);
  const highestDay = Math.max(1, ...report.byDay.map((d) => d.microdollars));
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">AI usage</h1>
          <p className="mt-2 text-muted">
            What Claude costs, from every AI call&apos;s tokens and the price in effect at the time. Days are Pacific time. Only you
            see this page.
          </p>
        </div>
        <form className="flex items-end gap-2">
          <label className="text-sm font-semibold">
            Month
            <input type="month" name="month" defaultValue={month} className={`mt-1 block ${inputClass}`} />
          </label>
          <button type="submit" className="btn-secondary">
            Show
          </button>
        </form>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-1">
          <p className="text-sm font-bold tracking-wider text-muted uppercase">{monthName}</p>
          <p className="mt-1 font-display text-4xl font-bold">{dollars(report.totalMicrodollars)}</p>
          <p className="text-sm text-muted">{calls(report.calls, "AI call")}</p>
        </div>
        {report.byFeature.map((f) => (
          <div key={f.feature} className="card p-5">
            <p className="text-sm font-bold tracking-wider text-muted uppercase">{FEATURE_LABELS[f.feature]}</p>
            <p className="mt-1 font-display text-3xl font-bold">{dollars(f.microdollars)}</p>
            <p className="text-sm text-muted">{calls(f.calls)}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-display text-xl font-bold">Spend by day</h2>
          <div className="mt-4 flex h-40 items-end gap-0.5" role="img" aria-label="Spend by day">
            {report.byDay.map((d) => (
              <div
                key={d.day}
                className="min-h-px flex-1 rounded-t bg-brand/70"
                style={{ height: `${(d.microdollars / highestDay) * 100}%` }}
                title={`${d.day}: ${dollars(d.microdollars)}`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{report.byDay[0]?.day.slice(5)}</span>
            <span>{report.byDay.at(-1)?.day.slice(5)}</span>
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-xl font-bold">By model</h2>
          {report.byModel.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No AI calls this month.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {report.byModel.map((m) => (
                <li key={m.model} className="flex justify-between gap-3">
                  <span className="font-mono">{m.model}</span>
                  <span>
                    {dollars(m.microdollars)} <span className="text-muted">· {m.calls}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-display text-xl font-bold">Unit costs</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-semibold">Feature</th>
                <th className="py-1 font-semibold">Average</th>
                <th className="py-1 font-semibold">Highest</th>
                <th className="py-1 font-semibold">Count</th>
              </tr>
            </thead>
            <tbody>
              {report.unitCosts.map((u) => (
                <tr key={u.feature} className="border-t border-border">
                  <td className="py-2">
                    {FEATURE_LABELS[u.feature]} <span className="text-muted">{UNIT_LABELS[u.feature]}</span>
                  </td>
                  <td className="py-2">{u.count ? dollars(u.average) : "—"}</td>
                  <td className="py-2">{u.count ? dollars(u.highest) : "—"}</td>
                  <td className="py-2">{u.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-xl font-bold">Assistant caching</h2>
          <p className="mt-3 text-sm">
            Actual: <strong>{dollars(report.cache.actualMicrodollars)}</strong>
          </p>
          <p className="text-sm">Without caching: {dollars(report.cache.withoutCacheMicrodollars)}</p>
          <p className="mt-2 font-semibold text-lime-ink">Saved {dollars(report.cache.savedMicrodollars)}</p>
          <p className="mt-2 text-xs text-muted">Reusing the Assistant&apos;s instructions and tools between calls bills them at a tenth of the price.</p>
        </div>
      </section>

      <section className="card mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <h2 className="font-display text-xl font-bold">By studio</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">Sort:</span>
            {SORTS.map((s) => (
              <Link
                key={s}
                href={`/dashboard/ai-usage?month=${month}&sort=${s}`}
                className={s === sort ? "font-bold underline underline-offset-4" : "text-muted hover:text-foreground"}
              >
                {{ cost: "Most expensive", percent: "Share of price", name: "Name" }[s]}
              </Link>
            ))}
            {studios.length > 0 && (
              <a href={`/dashboard/ai-usage/csv?month=${month}`} className="btn-secondary px-4 py-2 text-xs">
                Download spreadsheet
              </a>
            )}
          </div>
        </div>
        {studios.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">No studio used AI this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-muted">
                <tr>
                  <th className="px-5 py-2 font-semibold">Studio</th>
                  <th className="px-5 py-2 font-semibold">Plan</th>
                  <th className="px-5 py-2 font-semibold">AI spend</th>
                  <th className="px-5 py-2 font-semibold">List price / month</th>
                  <th className="px-5 py-2 font-semibold">AI as % of price</th>
                </tr>
              </thead>
              <tbody>
                {studios.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-5 py-2 font-semibold">{s.name}</td>
                    <td className="px-5 py-2">{PLAN_LABELS[s.plan] ?? s.plan}</td>
                    <td className="px-5 py-2">
                      {dollars(s.microdollars)} <span className="text-muted">· {calls(s.calls)}</span>
                    </td>
                    <td className="px-5 py-2">{s.listPriceCents ? formatPrice(s.listPriceCents) : "$0 (not paying)"}</td>
                    <td className="px-5 py-2">{s.percentOfPrice === null ? "—" : `${s.percentOfPrice}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-5 py-3 text-xs text-muted">
          List price is the plan&apos;s price while a subscription is being paid (yearly plans divided by 12). Coupons, referral credit
          and extra storage aren&apos;t included. Eval runs belong to no studio, so they&apos;re only in the totals.
        </p>
      </section>

      <section className="card mt-8 p-5">
        <h2 className="font-display text-xl font-bold">Data quality</h2>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <strong>{report.quality.estimateRows.toLocaleString()}</strong> estimated {report.quality.estimateRows === 1 ? "row" : "rows"} ({dollars(report.quality.estimateMicrodollars)}): recorded before cached
            and uncached input were kept apart, so every input token is priced at the full rate. That&apos;s an upper bound.
          </li>
          <li>
            <strong>{report.quality.unpricedRows.toLocaleString()}</strong> {report.quality.unpricedRows === 1 ? "row" : "rows"} with no price ({report.quality.unpricedTokens.toLocaleString()} tokens): a model
            that isn&apos;t in lib/ai/prices.ts. They&apos;re left out of the dollar totals.
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">Times are {REPORT_TIME_ZONE.replace("_", " ")}.</p>
      </section>
    </div>
  );
}
