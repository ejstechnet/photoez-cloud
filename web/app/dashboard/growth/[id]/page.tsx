import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { growthBudget } from "@/lib/growth/budget";
import { GROWTH_CRITERIA, type GrowthCriteria } from "@/lib/growth/constants";
import { featureNames, getOpportunity } from "@/lib/growth/opportunities";
import { NEEDS_EVIDENCE, STATUS_LABELS, effectiveScore } from "@/lib/growth/pipeline";
import { latestAnalyses, type PrefilterResult } from "@/lib/growth/qualify";
import { requireOwner } from "@/lib/owner";
import { KIND_LABELS, PLATFORM_LABELS, STATUS_STYLES, TIER_LABELS, TIER_STYLES, badge } from "../labels";
import { DeletePost, NextActionForm, NoteForm, ScoreForm, StatusForm } from "./post-controls";
import { ReplyBox, ScoreWithAi } from "./reply-box";

// The parts of a full scoring the page shows (saved as JSON by lib/growth/qualify.ts).
type FullResult = {
  summary: string;
  statedProblem: string;
  matchedFeatures: string[];
  missingInfo: string[];
  nextStep: string;
  shouldReply: boolean;
};

export const metadata = { title: "Post · Growth · PhotoEZ Cloud" };

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// One saved post: the original link and text, the AI's assessment and
// drafted reply, where it stands, its history, and Elle's notes.
export default async function GrowthPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const post = await getOpportunity(id);
  if (!post) notFound();
  const [ai, names, budget] = await Promise.all([latestAnalyses(id), featureNames(), growthBudget()]);
  const pre = ai.prefilter?.result as PrefilterResult | undefined;
  const full = ai.full?.result as FullResult | undefined;
  const criteria = ai.full?.criteria as GrowthCriteria | null | undefined;
  const posted = post.outreach.find((o) => o.state === "posted");
  const draft = post.outreach.find((o) => o.state !== "posted" && o.state !== "rejected");

  const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const score = effectiveScore(post.score, post.scoreOverride);
  const rules = post.source;

  return (
    <>
      <Link href="/dashboard/growth" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Growth
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`${badge} ${STATUS_STYLES[post.status]}`}>{STATUS_LABELS[post.status]}</span>
        {post.tier && (
          <span className={`${badge} ${TIER_STYLES[post.tier]}`}>
            {score} · {TIER_LABELS[post.tier]}
          </span>
        )}
        <span className={`${badge} bg-border text-muted`}>{KIND_LABELS[post.kind]}</span>
      </div>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight break-words sm:text-4xl">
        {post.title || (post.authorLabel ? `Post by ${post.authorLabel}` : "Saved post")}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {[
          PLATFORM_LABELS[post.platform],
          rules?.name,
          post.publishedAt && `posted ${day.format(post.publishedAt)}`,
          `saved ${when.format(post.discoveredAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold">What they wrote</h2>
              <a href={post.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary">
                Open the post ↗
              </a>
            </div>
            {/* Captured text is shown as plain text, never as HTML. */}
            <p className="mt-4 whitespace-pre-wrap break-words text-foreground/90">{post.excerpt || "No text saved."}</p>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">AI assessment</h2>
            {full && criteria ? (
              <>
                <p className="mt-2 text-lg">
                  <span className="font-display text-3xl font-bold">{ai.full?.total}</span>
                  <span className="text-muted"> / 100</span>
                  {!full.shouldReply && <span className={`${badge} ml-3 bg-sun/40 text-brand-deep`}>Maybe don&apos;t reply</span>}
                </p>
                <p className="mt-2">{full.summary}</p>
                <p className="mt-1 text-sm text-muted">Their problem: {full.statedProblem}</p>
                <ul className="mt-4 divide-y divide-border rounded-xl border-2 border-border">
                  {GROWTH_CRITERIA.map((c) => (
                    <li key={c.key} className="flex gap-3 px-4 py-3 text-sm">
                      <span className="w-14 shrink-0 font-bold">
                        {criteria[c.key].points}/{c.max}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{c.label}</span>
                        <span className="block break-words text-muted">{criteria[c.key].evidence}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {full.matchedFeatures.length > 0 && (
                  <p className="mt-4 text-sm">
                    <span className="font-semibold">What fits them: </span>
                    {full.matchedFeatures.map((k) => names[k] ?? k).join("; ")}
                  </p>
                )}
                {full.missingInfo.length > 0 && <p className="mt-2 text-sm text-muted">Worth knowing: {full.missingInfo.join(", ")}</p>}
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Next: </span>
                  {full.nextStep}
                </p>
                <p className="mt-3 text-xs text-muted">
                  Points only count when the AI quoted the post; code adds them up and works out recency from the post date.
                </p>
              </>
            ) : pre && !pre.relevant ? (
              <div className="mt-2 space-y-3">
                <p>The quick check thinks this isn&apos;t about running a photography business: {pre.reason}</p>
                <p className="text-sm text-muted">Disagree? Give it your own score, or mark it Not a fit.</p>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <p className="text-muted">
                  {!budget.on
                    ? "Growth AI is off, so score it yourself for now."
                    : budget.canSpend
                      ? "Not scored yet. New posts are scored automatically within a minute; if this one wasn't, score it now."
                      : "This month's Growth AI budget is used up. Score it yourself for now."}
                </p>
                {budget.canSpend && <ScoreWithAi id={post.id} />}
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">Your reply</h2>
            {posted ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-muted">Posted {when.format(posted.postedAt ?? posted.updatedAt)}:</p>
                <p className="whitespace-pre-wrap break-words rounded-xl bg-background p-4">{posted.postedText}</p>
              </div>
            ) : (
              <div className="mt-3">
                {!draft && <p className="mb-3 text-sm text-muted">No draft yet: write your own, or score it with AI for one.</p>}
                <ReplyBox
                  id={post.id}
                  postUrl={post.url}
                  outreachId={draft?.id ?? null}
                  draft={draft?.draft ?? ""}
                  linksAllowed={rules?.linksAllowed ?? false}
                />
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">Move it along</h2>
            <p className="mt-1 text-sm text-muted">
              Only record what really happened. From &ldquo;{STATUS_LABELS[NEEDS_EVIDENCE[0]]}&rdquo; on, say what it was.
            </p>
            <div className="mt-4">
              <StatusForm id={post.id} status={post.status} />
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">History</h2>
            <ol className="mt-4 space-y-3">
              {post.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="w-40 shrink-0 text-muted">{when.format(e.createdAt)}</span>
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {e.fromStatus ? `${STATUS_LABELS[e.fromStatus]} → ${STATUS_LABELS[e.toStatus]}` : STATUS_LABELS[e.toStatus]}
                    </span>
                    {e.evidence && <span className="block break-words text-foreground/80">{e.evidence}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">Score</h2>
            <p className="mt-1 text-sm text-muted">
              {post.score === null ? "Not scored yet. You can set your own." : `The AI scored it ${post.score}.`}
              {post.scoreOverride !== null && ` Your score: ${post.scoreOverride}${post.overrideReason ? ` (${post.overrideReason})` : ""}.`}
            </p>
            <div className="mt-4">
              <ScoreForm id={post.id} override={post.scoreOverride} reason={post.overrideReason} />
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">Follow up</h2>
            <div className="mt-4">
              <NextActionForm id={post.id} day={isoDay(post.nextActionAt)} />
            </div>
          </section>

          {rules && (
            <section className="card p-6">
              <h2 className="font-display text-xl font-bold">{rules.name}</h2>
              <ul className="mt-3 space-y-1 text-sm">
                <li>{rules.linksAllowed ? "✓ Links allowed" : "✗ No links"}</li>
                <li>{rules.selfPromoAllowed ? "✓ Self-promotion allowed" : "✗ No self-promotion"}</li>
                <li className="text-muted">Say: &ldquo;{rules.disclosure}&rdquo;</li>
              </ul>
              {rules.rulesNote && <p className="mt-3 text-sm text-muted">{rules.rulesNote}</p>}
            </section>
          )}

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">Notes</h2>
            <div className="mt-4">
              <NoteForm id={post.id} />
            </div>
            <ul className="mt-4 space-y-3">
              {post.notes.map((n) => (
                <li key={n.id} className="text-sm">
                  <span className="block text-xs text-muted">{when.format(n.createdAt)}</span>
                  <span className="block whitespace-pre-wrap break-words">{n.body}</span>
                </li>
              ))}
            </ul>
          </section>

          <DeletePost id={post.id} />
        </div>
      </div>
    </>
  );
}
