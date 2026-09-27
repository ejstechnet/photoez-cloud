"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteConversation } from "./actions";

// The × beside a saved conversation.
export function DeleteConversation({ id, current }: { id: string; current: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Delete this conversation"
      title="Delete"
      onClick={() =>
        confirm("Delete this conversation?") &&
        startTransition(async () => {
          await deleteConversation(id);
          if (current) router.push("/dashboard/assistant");
        })
      }
      className="shrink-0 rounded-full px-2 py-1 text-muted opacity-100 transition hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
    >
      ×
    </button>
  );
}
