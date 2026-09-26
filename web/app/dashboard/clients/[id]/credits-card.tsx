"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { formatPrice } from "@/lib/booking/format";
import { addClientCredit, removeClientCredit } from "../actions";
import { ConfirmButton } from "@/app/dashboard/bookings/confirm-button";

type Credit = {
  id: string;
  amountCents: number;
  usedCents: number;
  reason: string;
  expiresOn: string | null;
  expired: boolean;
};

// A client's session credits: what's left, where each came from, and when it
// expires, plus adding a credit by hand.
export function CreditsCard({
  clientId,
  hasEmail,
  credits,
  balanceCents,
}: {
  clientId: string;
  hasEmail: boolean;
  credits: Credit[];
  balanceCents: number;
}) {
  const [state, formAction, pending] = useActionState(addClientCredit.bind(null, clientId), {});

  return (
    <section className="card mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Session credits</h2>
        <p className="text-sm font-semibold">
          Available: <span className="text-lime-ink">{formatPrice(balanceCents)}</span>
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">
        Credit the client can put toward a booking. They choose to use it on the booking form (matched by their email).
      </p>

      {credits.length > 0 && (
        <ul className="mt-5 divide-y divide-border rounded-2xl border-2 border-border">
          {credits.map((c) => {
            const left = c.amountCents - c.usedCents;
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className={`font-semibold ${c.expired || left === 0 ? "text-muted line-through" : ""}`}>
                    {formatPrice(left)} left of {formatPrice(c.amountCents)}
                  </p>
                  <p className="text-xs text-muted">
                    {c.reason}
                    {c.expiresOn ? ` · ${c.expired ? "expired" : "expires"} ${c.expiresOn}` : " · never expires"}
                  </p>
                </div>
                <ConfirmButton
                  action={removeClientCredit.bind(null, clientId, c.id)}
                  confirmText="Remove this credit? The client won't be able to use it."
                  pendingLabel="Removing…"
                  danger
                >
                  Remove
                </ConfirmButton>
              </li>
            );
          })}
        </ul>
      )}

      {hasEmail ? (
        <form action={formAction} className="mt-5 space-y-3 border-t border-border pt-5">
          <p className="text-sm font-semibold">Add a credit</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Amount ($)" name="amount" inputMode="decimal" placeholder="50" />
            <Field label="Reason" name="reason" placeholder="Rescheduled by studio" hint="Only you see this." />
            <Field label="Expires" name="expiresOn" type="date" hint="Blank = your usual length" />
          </div>
          <FormError message={state.message} />
          <div className="flex items-center gap-4">
            <SubmitButton pending={pending} fullWidth={false}>
              Add credit
            </SubmitButton>
            {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Added</span>}
          </div>
        </form>
      ) : (
        <p className="mt-5 rounded-xl bg-sun/30 px-4 py-3 text-sm">
          Add the client&apos;s email above to give them credits: credits are matched by email when they book.
        </p>
      )}
    </section>
  );
}
