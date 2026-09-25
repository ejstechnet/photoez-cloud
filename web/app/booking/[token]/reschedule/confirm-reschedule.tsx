"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { rescheduleBooking, type ChangeState } from "../actions";

export function ConfirmReschedule({ token, startsAt, backHref }: { token: string; startsAt: string; backHref: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ChangeState>({});

  if (state.taken) {
    return (
      <div className="rounded-2xl bg-sun/30 px-5 py-4">
        <p className="font-semibold">Sorry, that time was just taken.</p>
        <Link href={backHref} className="link mt-1 inline-block font-semibold">
          Pick another time
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setState((await rescheduleBooking(token, startsAt)) ?? {}))}
        className="btn-primary w-full sm:w-auto"
      >
        {pending ? "Moving your session…" : "Confirm new time"}
      </button>
      {state.message && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}
