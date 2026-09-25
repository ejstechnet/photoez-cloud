"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton, TextAreaField, inputClass } from "@/components/form";
import type { BookingFieldType } from "@/lib/booking/fields";
import { depositCents, formatPrice } from "@/lib/booking/format";
import { createBooking, type BookingFormState } from "./actions";
import { InspoUploader } from "./inspo-uploader";

export type BookingQuestion = {
  id: string;
  label: string;
  type: BookingFieldType;
  options: string[];
  required: boolean;
};

export type BookingAddon = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  maxQuantity: number;
  includedQuantity: number;
  photoUrl: string | null;
};

// The last steps: optional extras, then the client's details, with a running
// total. The session, time, and extras are all re-checked on the server.
export function BookingForm({
  slug,
  sessionTypeId,
  startsAt,
  backHref,
  summary,
  priceCents,
  depositPercent,
  addons,
  questions,
  inspoMode,
}: {
  slug: string;
  sessionTypeId: string;
  startsAt: string;
  backHref: string;
  summary: React.ReactNode;
  priceCents: number;
  depositPercent: number;
  addons: BookingAddon[];
  questions: BookingQuestion[];
  inspoMode: "off" | "optional" | "required";
}) {
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    createBooking.bind(null, slug, sessionTypeId, startsAt),
    {},
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const errors = state.errors ?? {};
  const fieldErrors = state.fieldErrors ?? {};
  const extrasCents = addons.reduce((sum, a) => sum + (quantities[a.id] ?? 0) * a.priceCents, 0);
  const totalCents = priceCents + extrasCents;
  const step = (n: number) => (addons.length > 0 ? n : n - 1);

  const setQuantity = (addon: BookingAddon, quantity: number) =>
    setQuantities((current) => ({ ...current, [addon.id]: Math.max(0, Math.min(addon.maxQuantity, quantity)) }));

  if (state.taken) {
    return (
      <section className="card p-6 sm:p-8">
        <div className="rounded-2xl bg-sun/30 px-5 py-4">
          <p className="font-semibold">Sorry, that time was just booked.</p>
          <Link href={backHref} className="link mt-1 inline-block font-semibold">
            Pick another time
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      // Submitted by hand instead of action={…}: a form action resets every field
      // when it finishes, which would wipe the client's answers after an error.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-6"
      noValidate
    >
      {addons.length > 0 && (
        <section className="card p-6 sm:p-8">
          <StepHeading n={3}>Add extras</StepHeading>
          <p className="mt-1 text-sm text-muted">Optional. Add as many as you like, up to each limit.</p>
          <ul className="mt-5 grid gap-3">
            {addons.map((addon) => {
              const quantity = quantities[addon.id] ?? 0;
              return (
                <li
                  key={addon.id}
                  className={`flex gap-4 rounded-2xl border-2 p-3 transition ${quantity > 0 ? "border-lime bg-lime/10" : "border-border"}`}
                >
                  {/* Photo beside the content, like the layout planned for PhotoEZ Booking. */}
                  {addon.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={addon.photoUrl} alt="" className="size-20 shrink-0 rounded-xl object-cover sm:size-24" />
                  ) : (
                    <span className="grid size-20 shrink-0 place-items-center rounded-xl bg-background text-2xl sm:size-24" aria-hidden="true">
                      ✦
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div>
                      <p className="font-semibold">{addon.name}</p>
                      {addon.description && <p className="text-sm text-muted">{addon.description}</p>}
                      {addon.includedQuantity > 0 && (
                        <p className="mt-1.5 inline-block rounded-lg bg-lime/20 px-2.5 py-1 text-base font-bold text-brand-deep">
                          {addon.includedQuantity} included with your session
                        </p>
                      )}
                      <p className="mt-1 text-sm font-semibold text-lime-ink">
                        {formatPrice(addon.priceCents)} each{addon.includedQuantity > 0 && " for more"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(addon, quantity - 1)}
                        disabled={quantity === 0}
                        aria-label={`One fewer ${addon.name}`}
                        className="grid size-8 place-items-center rounded-full border-2 border-border font-bold transition hover:border-lime-ink disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-semibold" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(addon, quantity + 1)}
                        disabled={quantity >= addon.maxQuantity}
                        aria-label={`One more ${addon.name}`}
                        className="grid size-8 place-items-center rounded-full border-2 border-border font-bold transition hover:border-lime-ink disabled:opacity-30"
                      >
                        +
                      </button>
                      {quantity > 0 && (
                        <span className="ml-auto text-sm font-semibold">{formatPrice(quantity * addon.priceCents)}</span>
                      )}
                    </div>
                  </div>
                  <input type="hidden" name={`addon.${addon.id}`} value={quantity} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card relative p-6 sm:p-8">
        <StepHeading n={step(4)}>Your details</StepHeading>
        <div className="mt-4 rounded-2xl bg-sky-light/40 px-5 py-4">
          {summary}
          <dl className="mt-3 space-y-1 border-t border-brand/10 pt-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Session</dt>
              <dd>{formatPrice(priceCents)}</dd>
            </div>
            {extrasCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt>Extras</dt>
                <dd>{formatPrice(extrasCents)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(totalCents)}</dd>
            </div>
            {depositPercent > 0 && depositPercent < 100 && (
              <div className="flex justify-between gap-4 text-muted">
                <dt>Deposit ({depositPercent}%)</dt>
                <dd>{formatPrice(depositCents(totalCents, depositPercent))}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="mt-6 space-y-4">
          {/* Hidden from people; spam bots fill it in. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" name="name" autoComplete="name" error={errors.name} required />
            <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} required />
          </div>
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" error={errors.phone} hint="Optional" />
          <TextAreaField
            label="Anything we should know?"
            name="notes"
            rows={3}
            error={errors.notes}
            placeholder="Who's in the photos, ideas, questions…"
            hint="Optional"
          />
          {questions.map((q) => (
            <Question key={q.id} question={q} error={fieldErrors[q.id]} />
          ))}
          {inspoMode !== "off" && <InspoUploader slug={slug} required={inspoMode === "required"} error={state.inspoError} />}
          <FormError message={state.message} />
          <SubmitButton pending={pending}>Confirm booking</SubmitButton>
        </div>
      </section>
    </form>
  );
}

function StepHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-2xl font-bold">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-sans text-sm font-bold text-white">
        {n}
      </span>
      {children}
    </h2>
  );
}

// One of the studio's own questions, drawn to match its answer type.
function Question({ question: q, error }: { question: BookingQuestion; error?: string }) {
  const name = `field.${q.id}`;
  const label = (
    <>
      {q.label}
      {q.required && <span className="text-danger"> *</span>}
    </>
  );
  if (q.type === "checkbox") {
    return (
      <div>
        <label className="flex items-start gap-3 rounded-xl border-2 border-border px-3.5 py-3">
          <input type="checkbox" name={name} className="mt-1 size-4 accent-lime-ink" />
          <span className="text-sm font-semibold">{label}</span>
        </label>
        {error && <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
      </div>
    );
  }
  if (q.type === "select") {
    return (
      <SelectField label={q.label + (q.required ? " *" : "")} name={name} defaultValue="" error={error}>
        <option value="" disabled={q.required}>
          {q.required ? "Choose one…" : "No preference"}
        </option>
        {q.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </SelectField>
    );
  }
  if (q.type === "textarea") {
    return <TextAreaField label={q.label + (q.required ? " *" : "")} name={name} rows={3} error={error} />;
  }
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input name={name} aria-invalid={error ? true : undefined} className={`mt-1.5 ${inputClass}`} />
      {error && <span className="mt-1.5 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}
