"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { saveClientReferrals } from "./actions";

// Settings > Client referrals: clients share a link; a friend gets money off
// their first session, and once it has happened the client who shared gets a
// session credit (lib/client-referrals.ts).
export function ClientReferralsCard({
  enabled,
  rewardCents,
  discountCents,
}: {
  enabled: boolean;
  rewardCents: number;
  discountCents: number;
}) {
  const [state, formAction, pending] = useActionState(saveClientReferrals, {});
  return (
    <section id="client-referrals" className="card scroll-mt-8 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold">Client referrals</h2>
      <p className="mt-1 text-sm text-muted">
        Each client gets a share link (on their booking page and in their final photos email). A friend who books their
        first session through it gets money off, and after that session happens, the client who shared gets a session
        credit.
      </p>
      <form action={formAction} className="mt-6 space-y-5">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-5 accent-[var(--lime)]" />
          Turn on client referrals
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Friend's discount ($)"
            name="discount"
            inputMode="decimal"
            defaultValue={(discountCents / 100).toString()}
            hint="Off their first session"
          />
          <Field
            label="Credit for the client who shared ($)"
            name="reward"
            inputMode="decimal"
            defaultValue={(rewardCents / 100).toString()}
            hint="After the friend's session happens"
          />
        </div>
        <FormError message={state.message} />
        <div className="flex items-center gap-4">
          <SubmitButton pending={pending} fullWidth={false}>
            Save
          </SubmitButton>
          {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
        </div>
      </form>
    </section>
  );
}
