"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { saveExtraPhotoPrice } from "./actions";

// Settings > Plan: the photographer's tier and the gallery extras it unlocks.
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
    <section id="plan" className="card scroll-mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Plan</h2>
        <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold tracking-wider text-white uppercase">
          {planLabel}
        </span>
      </div>
      <h3 className="mt-5 text-sm font-semibold">Extra photos in proofing galleries</h3>
      {upsells ? (
        <form action={formAction} className="mt-2 space-y-3">
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
        <p className="mt-2 rounded-xl bg-sky-light/40 px-4 py-3 text-sm">
          Sell extra photos when clients love more than their package includes: available on the{" "}
          <strong>{upgradePlanLabel}</strong> plan and up.
        </p>
      )}
    </section>
  );
}
