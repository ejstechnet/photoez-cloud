"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { saveExtraPhotoPrice } from "./actions";

// Settings > Additional Photos: selling extra photos in proofing galleries,
// with the photographer's plan (which unlocks it) shown as a badge.
export function PlanCard({
  planLabel,
  upsells,
  upgradePlanLabel,
  extraPhotoPriceCents,
}: {
  planLabel: string;
  upsells: boolean;
  upgradePlanLabel: string;
  extraPhotoPriceCents: number;
}) {
  const [state, formAction, pending] = useActionState(saveExtraPhotoPrice, {});
  return (
    <section id="additional-photos" className="card scroll-mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Additional Photos</h2>
        <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-wider text-white uppercase">
          {planLabel} plan
        </span>
      </div>
      {upsells ? (
        <form action={formAction} className="mt-4 space-y-3">
          <p className="text-sm text-muted">
            Clients can pick more photos than a gallery includes, for this price each. Each gallery can use its own
            price in its Settings.
          </p>
          <Field
            label="Price per extra photo ($)"
            name="extraPhotoPrice"
            inputMode="decimal"
            defaultValue={(extraPhotoPriceCents / 100).toFixed(2)}
          />
          <FormError message={state.message} />
          <div className="flex items-center gap-4">
            <SubmitButton pending={pending} fullWidth={false}>
              Save price
            </SubmitButton>
            {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-sky-light/40 px-4 py-3 text-sm">
          Sell extra photos when clients love more than their package includes: available on the{" "}
          <strong>{upgradePlanLabel}</strong> plan and up.
        </p>
      )}
    </section>
  );
}
