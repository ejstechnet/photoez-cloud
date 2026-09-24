import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inquiries } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { SESSION_LABELS, STATUS_STYLES, URGENCY_STYLES, formatBudget, formatEventDate } from "../labels";
import { DraftReply } from "./draft-reply";
import { InquiryActions } from "./inquiry-actions";

export default async function InquiryPage({ params }: PageProps<"/dashboard/inquiries/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [inquiry] = await db
    .select()
    .from(inquiries)
    .where(and(eq(inquiries.id, id), eq(inquiries.photographerId, user.id)));
  if (!inquiry) notFound();

  const t = inquiry.triage;
  const status = STATUS_STYLES[inquiry.status];
  const contact = t?.email ?? inquiry.fromEmail;

  return (
    <>
      <Link href="/dashboard/inquiries" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← All inquiries
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${status.className}`}>
              {status.label}
            </span>
            {t && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${URGENCY_STYLES[t.urgency]}`}>
                {t.urgency} urgency
              </span>
            )}
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight break-words">
            {t?.clientName ?? inquiry.fromName ?? "New inquiry"}
          </h1>
          {t && <p className="mt-2 text-lg text-muted">{t.summary}</p>}
        </div>
      </div>

      <div className="mt-6">
        <InquiryActions
          inquiryId={inquiry.id}
          status={inquiry.status}
          clientId={inquiry.clientId}
          hasTriage={t !== null}
        />
      </div>

      {inquiry.triageError && !t && (
        <p role="alert" className="mt-6 rounded-2xl border-2 border-danger/30 bg-danger/10 px-5 py-4 text-sm font-medium text-danger">
          {inquiry.triageError}
        </p>
      )}

      {t && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="space-y-6">
            <div className="card p-6">
              <h2 className="font-display text-xl font-bold">The details</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Detail label="Session" value={SESSION_LABELS[t.sessionType]} note={t.sessionDetail} tint="bg-violet/15" />
                <Detail label="When" value={formatEventDate(t)} note={t.eventDate ? t.dateText : null} tint="bg-lime/15" />
                <Detail label="Where" value={t.location} tint="bg-sky-light/50" />
                <Detail label="Budget" value={formatBudget(t)} tint="bg-sun/20" />
                <Detail
                  label="People"
                  value={t.peopleCount !== null ? String(t.peopleCount) : null}
                  tint="bg-pink/15"
                />
                <Detail
                  label="Contact"
                  value={[t.email ?? inquiry.fromEmail, t.phone].filter(Boolean).join(" · ") || null}
                  tint="bg-coral/15"
                />
              </dl>
            </div>

            {t.questions.length > 0 && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-bold">Their questions</h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
                  {t.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            )}

            {t.missingInfo.length > 0 && (
              <div className="card p-6">
                <h2 className="font-display text-xl font-bold">Still needed</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.missingInfo.map((item) => (
                    <span key={item} className="rounded-full bg-sun/25 px-3 py-1 text-sm font-semibold">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold">Draft reply</h2>
            <p className="mt-1 text-sm text-muted">Written by AI in your voice. Read it over and edit before sending.</p>
            <div className="mt-4">
              <DraftReply key={inquiry.triagedAt?.toISOString()} draft={t.draftReply} to={contact} />
            </div>
          </section>
        </div>
      )}

      <details className="card mt-6 p-6">
        <summary className="cursor-pointer font-display text-xl font-bold">Original message</summary>
        <p className="mt-2 text-sm text-muted">
          {[inquiry.fromName, inquiry.fromEmail].filter(Boolean).join(" · ") || "Pasted in"} ·{" "}
          {inquiry.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <p className="mt-4 text-sm whitespace-pre-wrap">{inquiry.message}</p>
        {inquiry.model && (
          <p className="mt-4 text-xs text-muted">
            Triaged by {inquiry.model} · {(inquiry.inputTokens ?? 0) + (inquiry.outputTokens ?? 0)} tokens
          </p>
        )}
      </details>
    </>
  );
}

function Detail({
  label,
  value,
  note,
  tint,
}: {
  label: string;
  value: string | null;
  note?: string | null;
  tint: string;
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${tint}`}>
      <dt className="text-[11px] font-bold tracking-wider text-muted uppercase">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${value ? "" : "text-muted italic"}`}>{value ?? "Not mentioned"}</dd>
      {note && <dd className="mt-0.5 text-xs text-muted">{note}</dd>}
    </div>
  );
}
