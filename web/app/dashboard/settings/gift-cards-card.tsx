"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { saveGiftCardSettings } from "./actions";

// Settings > Gift cards: sell them on the studio page, the preset amounts,
// and whether buyers can choose their own amount (within a range).
export function GiftCardsCard({
  enabled,
  amounts,
  minCents,
  maxCents,
  paymentsReady,
}: {
  enabled: boolean;
  amounts: number[];
  minCents: number | null;
  maxCents: number | null;
  paymentsReady: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveGiftCardSettings, {});
  const [custom, setCustom] = useState(minCents !== null && maxCents !== null);
  return (
    <section id="gift-cards" className="card scroll-mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Gift cards</h2>
        <Link href="/dashboard/gift-cards" className="link text-sm">
          See gift cards
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Clients buy a gift card on your studio page and it&apos;s emailed to the person they choose. It&apos;s used when
        booking, and never expires.
      </p>
      <form action={formAction} className="mt-6 space-y-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="enabled" defaultChecked={enabled} className="mt-1 size-4 accent-lime-ink" />
          <span>
            <span className="block text-sm font-semibold">Sell gift cards on my studio page</span>
            <span className="block text-xs text-muted">
              {paymentsReady ? "Paid through your Stripe account." : "Connect Stripe (in Payments) to take payment for them."}
            </span>
          </span>
        </label>
        <Field
          label="Amounts to offer ($)"
          name="amounts"
          defaultValue={amounts.map((c) => c / 100).join(", ")}
          hint="Up to 6, separated by commas, e.g. 50, 100, 250."
        />
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="allowCustom"
            checked={custom}
            onChange={(e) => setCustom(e.target.checked)}
            className="size-4 accent-lime-ink"
          />
          <span className="text-sm font-semibold">Let buyers choose another amount</span>
        </label>
        {custom && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Smallest ($)" name="min" inputMode="numeric" defaultValue={minCents ? String(minCents / 100) : "25"} />
            <Field label="Largest ($)" name="max" inputMode="numeric" defaultValue={maxCents ? String(maxCents / 100) : "1000"} />
          </div>
        )}
        <FormError message={state.message} />
        <div className="flex items-center gap-4">
          <SubmitButton pending={pending} fullWidth={false}>
            Save gift card settings
          </SubmitButton>
          {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
        </div>
      </form>
    </section>
  );
}
