import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiTraces, aiTraceSteps, photographers } from "@/db/schema";
import { requireOwner } from "@/lib/owner";
import { OUTCOME_STYLES, outcomeLabel, seconds } from "../format";

export const metadata = { title: "AI trace · PhotoEZ Cloud" };

const STEP_LABELS: Record<string, string> = {
  model_call: "Model call",
  tool_call: "Tool",
  approval_requested: "Approval requested",
  approval_decided: "Approval decided",
  error: "Error",
};

const show = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value, null, 2));

// One Studio Assistant answer, step by step. Owner only.
export default async function AiTracePage({ params }: PageProps<"/dashboard/ai-traces/[id]">) {
  await requireOwner();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [row] = await db
    .select({ trace: aiTraces, studio: sql<string>`coalesce(${photographers.businessName}, ${photographers.name})` })
    .from(aiTraces)
    .innerJoin(photographers, eq(photographers.id, aiTraces.photographerId))
    .where(eq(aiTraces.id, id));
  if (!row) notFound();
  const { trace: t, studio } = row;
  const steps = await db.select().from(aiTraceSteps).where(eq(aiTraceSteps.traceId, id)).orderBy(asc(aiTraceSteps.stepIndex));
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium" });

  return (
    <div>
      <Link href="/dashboard/ai-traces" className="text-sm font-semibold text-muted hover:text-foreground">
        ← All traces
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">{t.question}</h1>
          <p className="mt-2 text-sm text-muted">
            {studio} · {when.format(t.startedAt)} · {t.model} · {seconds(t.latencyMs)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${OUTCOME_STYLES[t.outcome] ?? ""}`}>
          {outcomeLabel(t.outcome)}
        </span>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-4">
        {(
          [
            ["Input (uncached)", t.inputTokens],
            ["Cache read", t.cacheReadTokens],
            ["Cache write", t.cacheWriteTokens],
            ["Output", t.outputTokens],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="card p-4">
            <dt className="text-xs font-bold tracking-wider text-muted uppercase">{label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{n.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      {t.error && <p className="mt-4 rounded-xl bg-coral/15 p-4 text-sm text-coral">{t.error}</p>}

      <ol className="mt-8 space-y-3">
        {steps.map((s) => (
          <li key={s.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-muted">#{s.stepIndex}</span>
              <span className="font-semibold">
                {STEP_LABELS[s.stepType] ?? s.stepType}
                {s.toolName ? `: ${s.toolName}` : ""}
              </span>
              {s.status !== "ok" && (
                <span className="rounded-full bg-coral/20 px-2 py-0.5 text-[11px] font-bold text-coral uppercase">{s.status}</span>
              )}
              <span className="ml-auto text-sm text-muted">
                {s.latencyMs != null ? `${s.latencyMs} ms` : ""}
                {s.stepType === "model_call" &&
                  ` · ${s.inputTokens ?? 0} in, ${s.cacheReadTokens ?? 0} cache read, ${s.cacheWriteTokens ?? 0} cache write, ${s.outputTokens ?? 0} out · ${s.stopReason ?? ""}`}
              </span>
            </div>
            {s.requestId && <p className="mt-1 font-mono text-xs text-muted">Request {s.requestId}</p>}
            {s.error && <p className="mt-2 text-sm text-coral">{s.error}</p>}
            {s.toolInput != null && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-muted">Input</summary>
                <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-background p-3 text-xs whitespace-pre-wrap">{show(s.toolInput)}</pre>
              </details>
            )}
            {s.toolOutput != null && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-semibold text-muted">Output{s.truncated ? " (cut at 10 KB)" : ""}</summary>
                <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-background p-3 text-xs whitespace-pre-wrap">{show(s.toolOutput)}</pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
