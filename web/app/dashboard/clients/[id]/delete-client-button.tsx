"use client";

import { useTransition } from "react";
import { deleteClient } from "../actions";

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Delete ${clientName}? This can't be undone.`)) return;
    startTransition(() => deleteClient(clientId));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete client"}
    </button>
  );
}
