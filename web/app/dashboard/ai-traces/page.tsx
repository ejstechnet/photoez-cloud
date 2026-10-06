import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiTraces, aiTraceSteps, photographers } from "@/db/schema";
import { AI_TRACE_KEEP_DAYS } from "@/lib/ai/assistant/trace";
import { requireOwner } from "@/lib/owner";
import { OUTCOME_STYLES, outcomeLabel, seconds } from "./format";

export const metadata = { title: "AI traces · PhotoEZ Cloud" };

// The owner's view of Studio Assistant step logs: the newest answers across
// every studio. Each opens to its steps (lib/ai/assistant/trace.ts).
export default async function AiTracesPage() {
  await requireOwner();
  const rows = await db
    .select({
      trace: aiTraces,
      studio: sql<string>`coalesce(${photographers.businessName}, ${photographers.name})`,
      steps: sql<number>`(select count(*) from ${aiTraceSteps} where ${aiTraceSteps.traceId} = ${aiTraces.id})::int`,
    })
    .from(aiTraces)
    .innerJoin(photographers, eq(photographers.id, aiTraces.photographerId))
    .orderBy(desc(aiTraces.startedAt))
    .limit(100);
  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div>
      <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">AI traces</h1>
      <p className="mt-2 text-muted">
        Every Studio Assistant answer, step by step: each model call and look-up, what came back, and how long it took. The
        newest 100, kept {AI_TRACE_KEEP_DAYS} days. Only you see this page.
      </p>

      {rows.length === 0 ? (
        <div className="card mt-8 p-8 text-center text-muted">No Studio Assistant answers yet.</div>
      ) : (
        <ul className="card mt-8 divide-y divide-border overflow-hidden">
          {rows.map(({ trace: t, studio, steps }) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/ai-traces/${t.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-lime/10 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="w-32 shrink-0 text-sm text-muted">{when.format(t.startedAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.question}</span>
                  <span className="block truncate text-sm text-muted">
                    {studio} · {steps} steps · {seconds(t.latencyMs)} ·{" "}
                    {(t.inputTokens + t.cacheReadTokens + t.cacheWriteTokens).toLocaleString()} in (
                    {t.cacheReadTokens.toLocaleString()} cached) / {t.outputTokens.toLocaleString()} out
                  </span>
                </span>
                <span
                  className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase sm:self-center ${OUTCOME_STYLES[t.outcome] ?? ""}`}
                >
                  {outcomeLabel(t.outcome)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
