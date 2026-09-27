"use client";

import { useActionState, useState } from "react";
import { Field, FormError, SubmitButton, TextAreaField, inputClass } from "@/components/form";
import { formatPrice } from "@/lib/booking/format";
import { buyGiftCard, type GiftFormState } from "./actions";

// Choose an amount, who it's for, an optional message and delivery day, and
// who's giving it; then on to Stripe to pay.
export function GiftCardForm({
  slug,
  amounts,
  minCents,
  maxCents,
  today,
}: {
  slug: string;
  amounts: number[];
  minCents: number | null;
  maxCents: number | null;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<GiftFormState, FormData>(buyGiftCard.bind(null, slug), {});
  const [choice, setChoice] = useState(String(amounts[1] ?? amounts[0] ?? "custom"));
  const [custom, setCustom] = useState("");
  const errors = state.errors ?? {};
  const allowCustom = minCents !== null && maxCents !== null;
  const shown = choice === "custom" ? Math.round(Number(custom || 0) * 100) : Number(choice);

  return (
    <form action={formAction} className="space-y-6">
      {/* Hidden from people; spam bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Amount</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {amounts.map((cents) => (
            <label
              key={cents}
              className={`cursor-pointer rounded-2xl border-2 px-5 py-3 font-display text-2xl font-bold transition ${
                choice === String(cents) ? "border-lime bg-lime/15" : "border-border hover:border-muted"
              }`}
            >
              <input type="radio" name="amount" value={cents} checked={choice === String(cents)} onChange={() => setChoice(String(cents))} className="sr-only" />
              {formatPrice(cents)}
            </label>
          ))}
          {allowCustom && (
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-3 transition ${
                choice === "custom" ? "border-lime bg-lime/15" : "border-border hover:border-muted"
              }`}
            >
              <input type="radio" name="amount" value="custom" checked={choice === "custom"} onChange={() => setChoice("custom")} className="sr-only" />
              <span className="font-semibold">Other $</span>
              <input
                name="customAmount"
                inputMode="numeric"
                value={custom}
                onFocus={() => setChoice("custom")}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={String(minCents! / 100)}
                aria-label="Other amount in dollars"
                className="w-20 rounded-lg border-2 border-border bg-surface px-2 py-1 text-lg font-bold outline-none focus:border-lime-ink"
              />
            </label>
          )}
        </div>
        {allowCustom && (
          <p className="mt-1.5 text-xs text-muted">
            Other amounts from {formatPrice(minCents!)} to {formatPrice(maxCents!)}.
          </p>
        )}
        {errors.amount && <p className="mt-1.5 text-xs font-medium text-danger">{errors.amount}</p>}
      </fieldset>

      <div className="rounded-2xl bg-background p-5">
        <h2 className="font-display text-xl font-bold">Who&apos;s it for?</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Their name" name="recipientName" error={errors.recipientName} required />
          <Field label="Their email" name="recipientEmail" type="email" error={errors.recipientEmail} required />
        </div>
        <div className="mt-4">
          <TextAreaField label="A message (optional)" name="message" rows={3} maxLength={500} error={errors.message} placeholder="Happy birthday! Can't wait to see your photos." />
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">Send it on</span>
          <input type="date" name="deliverOn" min={today} className={`mt-1.5 ${inputClass} sm:max-w-xs`} />
          <span className="mt-1.5 block text-xs text-muted">Leave blank to send it right away, or pick a day like their birthday.</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="buyerName" autoComplete="name" error={errors.buyerName} required />
        <Field label="Your email (for the receipt)" name="buyerEmail" type="email" autoComplete="email" error={errors.buyerEmail} required />
      </div>

      <FormError message={state.errors ? null : state.message} />
      <SubmitButton pending={pending}>{shown > 0 ? `Continue to pay ${formatPrice(shown)}` : "Continue to payment"}</SubmitButton>
      <p className="text-center text-xs text-muted">Secure payment by Stripe. The gift card never expires.</p>
    </form>
  );
}
