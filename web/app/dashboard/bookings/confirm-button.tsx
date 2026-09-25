"use client";

import { useState, useTransition } from "react";

// A button that runs a server action, optionally after a confirm() prompt,
// and shows the action's error message if it returns one.
export function ConfirmButton({
  action,
  confirmText,
  pendingLabel = "Please wait…",
  danger = false,
  children,
}: {
  action: () => Promise<void | { message?: string }>;
  confirmText?: string;
  pendingLabel?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    if (confirmText && !confirm(confirmText)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result?.message) setMessage(result.message);
    });
  }

  return (
    <span className="inline-flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`rounded-full border-2 px-5 py-2 text-xs font-bold tracking-wider uppercase transition disabled:opacity-60 ${
          danger
            ? "border-danger/40 text-danger hover:bg-danger/10"
            : "border-border text-foreground hover:border-lime-ink hover:bg-lime/15"
        }`}
      >
        {pending ? pendingLabel : children}
      </button>
      {message && (
        <span role="alert" className="text-xs font-medium text-danger">
          {message}
        </span>
      )}
    </span>
  );
}
