"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProposalDelivery } from "@/db/schema";
import type { CardOutcome } from "@/lib/ai/assistant/executor";
import type { SavedProposal } from "@/lib/ai/assistant/history";
import type { Proposal } from "@/lib/ai/assistant/tools";
import { approveProposal, ask, dismissProposal, retryProposal } from "./actions";

// A proposal fresh from the assistant is pending; reopened ones carry their outcome.
type CardProposal = Proposal & Partial<Pick<SavedProposal, "status" | "result" | "deliveries">>;

export type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; proposals: CardProposal[] }
  | { kind: "error"; text: string };

const SUGGESTIONS = [
  "Who still owes a balance for sessions in the next two weeks?",
  "Which galleries close in the next 7 days?",
  "How much did I collect this month?",
  "Any new inquiries that need me?",
  "Which delivered galleries haven't been asked for a review?",
];

// Assistant answers can use **bold** and "- " lists; show them simply.
function Formatted({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[15px] leading-relaxed">
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const parts = line.replace(/^\s*[-*•]\s+/, "").split(/\*\*(.+?)\*\*/g);
        const content = parts.map((part, j) => (j % 2 ? <strong key={j}>{part}</strong> : part));
        if (!line.trim()) return <div key={i} className="h-1" />;
        return bullet ? (
          <p key={i} className="flex gap-2 pl-1">
            <span className="text-lime-ink">•</span>
            <span>{content}</span>
          </p>
        ) : (
          <p key={i}>{content}</p>
        );
      })}
    </div>
  );
}

type CardView = { done: boolean; text: string; deliveries: ProposalDelivery[] | null; retry: boolean };

// What a reopened card says, by its status (null: still waiting for a decision).
function cardState(proposal: CardProposal): CardView | null {
  const deliveries = proposal.deliveries ?? null;
  switch (proposal.status) {
    case "executed":
      return { done: true, text: `✓ ${proposal.result ?? "Approved."}`, deliveries, retry: false };
    case "failed":
      return { done: false, text: proposal.result ?? "Something went wrong.", deliveries, retry: canRetry(deliveries) };
    case "approved":
    case "executing":
      return { done: false, text: "Approved. Working on it…", deliveries, retry: false };
    case "rejected":
      return { done: false, text: "Dismissed. Nothing was sent.", deliveries: null, retry: false };
    case "expired":
      return { done: false, text: "Expired (cards last 24 hours). Nothing was sent. Ask me to prepare it again.", deliveries: null, retry: false };
    default:
      return null;
  }
}

const fromOutcome = (o: CardOutcome): CardView => ({
  done: o.ok,
  text: o.ok ? `✓ ${o.message}` : o.message,
  deliveries: o.deliveries ?? null,
  retry: o.status === "failed" && canRetry(o.deliveries ?? null),
});

// Anyone left who certainly didn't get it (never the "not sure" ones).
const canRetry = (deliveries: ProposalDelivery[] | null) => Boolean(deliveries?.some((d) => d.status === "failed" || d.status === "pending"));

const DELIVERY_MARKS: Record<ProposalDelivery["status"], { mark: string; className: string; label: string }> = {
  sent: { mark: "✓", className: "text-lime-ink", label: "Done" },
  failed: { mark: "✗", className: "text-coral", label: "Didn't go through" },
  unknown: { mark: "?", className: "text-brand-deep", label: "Not sure it went through" },
  sending: { mark: "?", className: "text-brand-deep", label: "Not sure it went through" },
  skipped: { mark: "–", className: "text-muted", label: "Skipped" },
  pending: { mark: "…", className: "text-muted", label: "Not tried yet" },
};

// Who got it, shown once a card has run and not everything went through.
function Deliveries({ deliveries }: { deliveries: ProposalDelivery[] }) {
  if (deliveries.every((d) => d.status === "sent")) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {deliveries.map((d) => {
        const m = DELIVERY_MARKS[d.status];
        return (
          <li key={d.key} className="flex gap-2 rounded-lg bg-surface/70 px-3 py-1.5">
            <span className={`w-4 shrink-0 font-bold ${m.className}`} aria-label={m.label} title={m.label}>
              {m.mark}
            </span>
            <span className="min-w-0">
              {d.label}
              {d.note && <span className="block text-xs text-muted">{d.note}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ProposalCard({ proposal }: { proposal: CardProposal }) {
  const [state, setState] = useState<CardView | null>(cardState(proposal));
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-3 rounded-2xl border-2 border-lime/60 bg-lime/10 p-4">
      <p className="text-xs font-bold tracking-wider text-lime-ink uppercase">Ready for your approval</p>
      <p className="mt-1 font-semibold">{proposal.summary}</p>
      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm">
        {proposal.details.map((line, i) => (
          <li key={i} className="whitespace-pre-line rounded-lg bg-surface/70 px-3 py-1.5">
            {line}
          </li>
        ))}
      </ul>
      {state ? (
        <>
          <p className={`mt-3 text-sm font-semibold ${state.done ? "text-lime-ink" : "text-muted"}`}>{state.text}</p>
          {state.deliveries && <Deliveries deliveries={state.deliveries} />}
          {state.retry && (
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => setState(fromOutcome(await retryProposal(proposal.id))))}
              className="btn-secondary mt-3 px-5 py-2 text-xs"
            >
              {pending ? "Working…" : "Try again for the rest"}
            </button>
          )}
        </>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => setState(fromOutcome(await approveProposal(proposal.id))))}
            className="btn-primary px-5 py-2 text-xs"
          >
            {pending ? "Working…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await dismissProposal(proposal.id);
                setState({ done: false, text: "Dismissed. Nothing was sent.", deliveries: null, retry: false });
              })
            }
            className="rounded-full px-4 py-2 text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// The Studio Assistant chat: questions in, answers and approval cards out.
export function Chat({
  questionsLeft,
  conversationId: initialId,
  initialEntries,
}: {
  questionsLeft: number;
  conversationId: string | null;
  initialEntries: Entry[];
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialId);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [input, setInput] = useState("");
  const [left, setLeft] = useState(questionsLeft);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an
  // effect that returns anything but a cleanup function crashes React.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, pending]);

  function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setEntries((current) => [...current, { kind: "user", text: q }]);
    setInput("");
    startTransition(async () => {
      const result = await ask(conversationId, q);
      setEntries((current) => [
        ...current,
        "error" in result ? { kind: "error", text: result.error } : { kind: "assistant", text: result.answer, proposals: result.proposals },
      ]);
      if (!("error" in result)) {
        setLeft((n) => Math.max(0, n - 1));
        // A new chat gets its own address, and the Recent list updates.
        if (result.conversationId !== conversationId) {
          setConversationId(result.conversationId);
          router.replace(`/dashboard/assistant?c=${result.conversationId}`, { scroll: false });
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="card flex min-h-[60vh] flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
        {entries.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-4xl">🤖</p>
            <p className="mt-3 font-display text-2xl font-bold">How can I help with your studio today?</p>
            <p className="mt-1 text-sm text-muted">I can look things up and get emails and changes ready. Nothing is sent until you approve it.</p>
            <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border-2 border-border px-3.5 py-1.5 text-sm transition hover:border-lime">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {entries.map((entry, i) =>
          entry.kind === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-white">{entry.text}</p>
            </div>
          ) : entry.kind === "error" ? (
            <p key={i} className="rounded-2xl bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">
              {entry.text}
            </p>
          ) : (
            <div key={i} className="max-w-[90%] rounded-2xl rounded-bl-md bg-background px-4 py-3">
              <Formatted text={entry.text} />
              {entry.proposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} />
              ))}
            </div>
          ),
        )}
        {pending && (
          <p className="w-fit animate-pulse rounded-2xl bg-background px-4 py-2.5 text-sm text-muted">Looking into it…</p>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-border bg-surface p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about bookings, galleries, clients, payments…"
          aria-label="Ask the Studio Assistant"
          maxLength={2000}
          className="block w-full rounded-full border-2 border-border bg-surface px-4 py-2.5 outline-none focus:border-lime-ink"
        />
        <button type="submit" disabled={pending || !input.trim()} className="btn-primary shrink-0 px-5">
          Ask
        </button>
      </form>
      <p className="border-t border-border bg-surface px-4 py-2 text-center text-xs text-muted">
        {left.toLocaleString()} questions left this month · Answers can be wrong, so check before approving.
      </p>
    </div>
  );
}
