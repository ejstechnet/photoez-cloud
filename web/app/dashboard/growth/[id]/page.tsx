import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getOpportunity } from "@/lib/growth/opportunities";
import { NEEDS_EVIDENCE, STATUS_LABELS, effectiveScore } from "@/lib/growth/pipeline";
import { requireOwner } from "@/lib/owner";
import { KIND_LABELS, PLATFORM_LABELS, STATUS_STYLES, TIER_LABELS, TIER_STYLES, badge } from "../labels";
import { DeletePost, NextActionForm, NoteForm, ScoreForm, StatusForm } from "./post-controls";

export const metadata = { title: "Post · Growth · PhotoEZ Cloud" };

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

// One saved post: the original link and text, where it stands, its history,
// and Elle's notes. (Scoring and drafted replies come in later steps.)
export default async function GrowthPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const post = await getOpportunity(id);
  if (!post) notFound();

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
              {post.score === null
                ? "AI scoring arrives in a later step. You can set your own now."
                : `The AI scored it ${post.score}.`}
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
