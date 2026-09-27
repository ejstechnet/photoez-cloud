import Link from "next/link";
import { assistantAllowance } from "@/lib/ai/assistant/run";
import { loadConversation, recentConversations, KEEP_CONVERSATIONS, KEEP_DAYS } from "@/lib/ai/assistant/history";
import { formatDate } from "@/lib/booking/time";
import { PLAN_LABELS, planFor } from "@/lib/plans";
import { requirePhotographer } from "@/lib/session";
import { Chat, type Entry } from "./chat";
import { DeleteConversation } from "./delete-conversation";

export const metadata = { title: "Studio Assistant · PhotoEZ Cloud" };

export default async function AssistantPage({ searchParams }: PageProps<"/dashboard/assistant">) {
  const user = await requirePhotographer();
  const allowance = await assistantAllowance(user.id);
  const { c } = await searchParams;
  const recent = await recentConversations(user.id);

  // A saved conversation to show again (?c=…), with its approval cards.
  let conversationId: string | null = null;
  let entries: Entry[] = [];
  if (typeof c === "string" && /^[0-9a-f-]{36}$/i.test(c)) {
    const loaded = await loadConversation(user.id, c);
    if (loaded) {
      conversationId = loaded.conversation.id;
      entries = loaded.conversation.turns.map((t): Entry =>
        t.role === "user"
          ? { kind: "user", text: t.text }
          : {
              kind: "assistant",
              text: t.text,
              proposals: (t.proposalIds ?? []).flatMap((id) => {
                const p = loaded.proposals.get(id);
                return p ? [p] : [];
              }),
            },
      );
    }
  }

  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-violet uppercase">AI helper</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Studio Assistant</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Ask about your bookings, galleries, clients, and payments, get photography and business advice, or have it get
        reminders and emails ready. You approve everything before it goes out.
      </p>
      {allowance.enabled ? (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="card p-4 lg:sticky lg:top-6">
            <Link href="/dashboard/assistant" className="btn-primary w-full py-2 text-xs">
              + New chat
            </Link>
            <p className="mt-5 text-xs font-bold tracking-wider text-muted uppercase">Recent</p>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Your conversations will show up here.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {recent.map((r) => (
                  <li key={r.id} className="group flex items-center gap-1">
                    <Link
                      href={`/dashboard/assistant?c=${r.id}`}
                      className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-sm transition hover:bg-background ${
                        r.id === conversationId ? "bg-lime/15 font-semibold" : ""
                      }`}
                    >
                      <span className="block truncate">{r.title}</span>
                      <span className="block text-xs text-muted">{formatDate(r.updatedAt, allowance.timeZone, "short")}</span>
                    </Link>
                    <DeleteConversation id={r.id} current={r.id === conversationId} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted">
              Your {KEEP_CONVERSATIONS} most recent chats are kept for {KEEP_DAYS} days.
            </p>
          </aside>
          <Chat key={conversationId ?? "new"} questionsLeft={allowance.left} conversationId={conversationId} initialEntries={entries} />
        </div>
      ) : (
        <div className="card mt-8 p-8 text-center">
          <p className="font-display text-2xl font-bold">The Studio Assistant is on the {PLAN_LABELS[planFor("aiSearch")]} plan and up.</p>
          <p className="mt-2 text-muted">It comes with AI gallery search too.</p>
          <Link href="/dashboard/settings" className="btn-primary mt-5">
            See plans
          </Link>
        </div>
      )}
    </div>
  );
}
