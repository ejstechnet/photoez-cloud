"use client";

import { SmsConsent } from "@/components/sms-consent";
import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton, TextAreaField, inputClass } from "@/components/form";
import type { BookingFieldType } from "@/lib/booking/fields";
import { depositCents, formatPrice } from "@/lib/booking/format";
import { couponDiscount } from "@/lib/coupons";
import { createBooking, creditAvailable, previewCoupon, previewGiftCard, type BookingFormState } from "./actions";
import { InspoUploader } from "./inspo-uploader";
import { BookingSteps } from "./booking-steps";

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
  changeSessionHref,
  changeDateHref,
  summary,
  priceCents,
  depositPercent,
  addons,
  questions,
  inspoMode,
  giftCardsOn,
  textsOn = false,
  friend = null,
}: {
  slug: string;
  sessionTypeId: string;
  startsAt: string;
  // Back to picking a time, a day, or the session.
  backHref: string;
  changeSessionHref: string;
  changeDateHref: string;
  summary: React.ReactNode;
  priceCents: number;
  depositPercent: number;
  addons: BookingAddon[];
  questions: BookingQuestion[];
  inspoMode: "off" | "optional" | "required";
  // Show the gift card field (the studio sells gift cards or has issued some).
  giftCardsOn: boolean;
  // The studio sends text reminders: offer the opt-in checkbox.
  textsOn?: boolean;
  // Came through a client's share link: the friend discount for a first session.
  friend?: { code: string; name: string; discountCents: number } | null;
}) {
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    createBooking.bind(null, slug, sessionTypeId, startsAt),
    {},
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const errors = state.errors ?? {};
  const fieldErrors = state.fieldErrors ?? {};
  const extrasCents = addons.reduce((sum, a) => sum + (quantities[a.id] ?? 0) * a.priceCents, 0);
  const [coupon, setCoupon] = useState<{ code: string; kind: "percent" | "amount"; value: number } | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  // The client's session credit here (0 = none), and whether they're using it.
  const [creditCents, setCreditCents] = useState(0);
  const [useCredit, setUseCredit] = useState(true);
  const discountCents = coupon ? couponDiscount(coupon, priceCents + extrasCents) : 0;
  // Checked again on the server: first bookings with the studio only.
  const friendCents = friend ? Math.min(friend.discountCents, priceCents + extrasCents - discountCents) : 0;
  const totalCents = priceCents + extrasCents - discountCents - friendCents;
  const [giftCard, setGiftCard] = useState<{ code: string; balanceCents: number } | null>(null);
  const [giftInput, setGiftInput] = useState("");
  const [giftMessage, setGiftMessage] = useState<string | null>(null);
  const [checkingGift, setCheckingGift] = useState(false);
  // Credit comes off first, then the gift card (the same order as booking).
  const creditApplied = useCredit ? Math.min(creditCents, totalCents) : 0;
  const giftCents = giftCard ? Math.min(giftCard.balanceCents, totalCents - creditApplied) : 0;
  const leftCents = totalCents - creditApplied - giftCents;

  async function applyGiftCard() {
    setGiftMessage(null);
    setCheckingGift(true);
    const result = await previewGiftCard(slug, giftInput);
    setCheckingGift(false);
    if (result.ok) setGiftCard(result);
    else setGiftMessage(result.message);
  }

  async function applyCoupon() {
    setCouponMessage(null);
    setCheckingCoupon(true);
    const email = (document.querySelector<HTMLInputElement>('input[name="email"]')?.value ?? "").trim();
    const result = await previewCoupon(slug, sessionTypeId, couponInput, priceCents + extrasCents, email);
    setCheckingCoupon(false);
    if (result.ok) setCoupon(result);
    else setCouponMessage(result.message);
  }
  // The last steps of the step form: Extras (when there are any), then details.
  const hasExtras = addons.length > 0;
  const [formStep, setFormStep] = useState<"extras" | "details">(hasExtras ? "extras" : "details");
  const goTo = (next: "extras" | "details") => {
    setFormStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
      <BookingSteps current={formStep} hasExtras={hasExtras} />
      {/* What's chosen so far, with a way back to each part. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-lime/15 px-5 py-4">
        <div>{summary}</div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold tracking-wider uppercase">
          <Link href={changeSessionHref} className="text-link hover:underline">
            Change session
          </Link>
          <Link href={changeDateHref} className="text-link hover:underline">
            Change day
          </Link>
          <Link href={backHref} className="text-link hover:underline">
            Change time
          </Link>
        </p>
      </div>
      {addons.length > 0 && (
        // Hidden rather than removed on the next step, so the picks still submit.
        <section className={`card p-6 sm:p-8 ${formStep === "extras" ? "" : "hidden"}`}>
          <StepHeading>Add extras</StepHeading>
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
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Link href={backHref} className="text-sm font-bold tracking-wider text-link uppercase hover:underline">
              ← Pick another time
            </Link>
            <button type="button" className="btn-primary" onClick={() => goTo("details")}>
              {extrasCents > 0 ? `Continue with extras · ${formatPrice(extrasCents)}` : "Continue without extras"}
            </button>
          </div>
        </section>
      )}

      <section className={`card relative p-6 sm:p-8 ${formStep === "details" ? "" : "hidden"}`}>
        <StepHeading>Your details</StepHeading>
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
            {coupon && discountCents > 0 && (
              <div className="flex justify-between gap-4 text-lime-ink">
                <dt>Coupon {coupon.code}</dt>
                <dd>−{formatPrice(discountCents)}</dd>
              </div>
            )}
            {friendCents > 0 && (
              <div className="flex justify-between gap-4 text-lime-ink">
                <dt>Friend discount (from {friend!.name})</dt>
                <dd>−{formatPrice(friendCents)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(totalCents)}</dd>
            </div>
            {creditApplied > 0 && (
              <div className="flex justify-between gap-4 text-lime-ink">
                <dt>Session credit</dt>
                <dd>−{formatPrice(creditApplied)}</dd>
              </div>
            )}
            {giftCents > 0 && (
              <div className="flex justify-between gap-4 text-lime-ink">
                <dt>Gift card {giftCard?.code}</dt>
                <dd>−{formatPrice(giftCents)}</dd>
              </div>
            )}
            {leftCents < totalCents && (
              <div className="flex justify-between gap-4 font-semibold">
                <dt>Left to pay</dt>
                <dd>{formatPrice(leftCents)}</dd>
              </div>
            )}
            {depositPercent > 0 && depositPercent < 100 && leftCents > 0 && (
              <div className="flex justify-between gap-4 text-muted">
                <dt>Deposit ({depositPercent}%{leftCents < totalCents ? " of what's left" : ""})</dt>
                <dd>{formatPrice(depositCents(leftCents, depositPercent))}</dd>
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
          <Field
            label="Session title"
            name="title"
            maxLength={120}
            placeholder="Example: Tina's Senior Photos"
            hint="What should we call your session? It becomes the name of your photo gallery."
            error={errors.title}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" name="name" autoComplete="name" error={errors.name} required />
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              error={errors.email}
              required
              onBlur={async (e) => setCreditCents(await creditAvailable(slug, e.currentTarget.value))}
            />
          </div>
          {creditCents > 0 && (
            <label className="flex items-start gap-3 rounded-xl border-2 border-lime/60 bg-lime/10 px-3.5 py-3">
              <input
                type="checkbox"
                name="useCredit"
                checked={useCredit}
                onChange={(e) => setUseCredit(e.target.checked)}
                className="mt-1 size-4 accent-lime-ink"
              />
              <span className="text-sm">
                <span className="block font-semibold">You have a {formatPrice(creditCents)} session credit with this studio.</span>
                {creditCents > totalCents
                  ? `Use it for this booking? It covers the whole ${formatPrice(totalCents)}, and ${formatPrice(creditCents - totalCents)} stays for next time.`
                  : `Use it for this booking? ${formatPrice(creditCents)} comes off your total, and the deposit is figured on what's left.`}
              </span>
            </label>
          )}
          <div>
            <span className="text-sm font-semibold">Coupon code</span>
            <div className="mt-1.5 flex gap-2">
              <input
                value={coupon ? coupon.code : couponInput}
                onChange={(e) => {
                  setCoupon(null);
                  setCouponInput(e.target.value);
                }}
                aria-label="Coupon code"
                autoCapitalize="characters"
                placeholder="Optional"
                className={`${inputClass} uppercase`}
              />
              {coupon ? (
                <button type="button" onClick={() => setCoupon(null)} className="btn-secondary shrink-0">
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={checkingCoupon || couponInput.trim() === ""}
                  className="btn-secondary shrink-0"
                >
                  {checkingCoupon ? "Checking…" : "Apply"}
                </button>
              )}
            </div>
            {coupon && <p className="mt-1.5 text-xs font-semibold text-lime-ink">Coupon applied.</p>}
            {(couponMessage || state.couponError) && (
              <p className="mt-1.5 text-xs font-medium text-danger">{couponMessage ?? state.couponError}</p>
            )}
            {coupon && <input type="hidden" name="couponCode" value={coupon.code} />}
            {friend && <input type="hidden" name="friendCode" value={friend.code} />}
          </div>
          {giftCardsOn && (
            <div>
              <span className="text-sm font-semibold">Gift card</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={giftCard ? giftCard.code : giftInput}
                  onChange={(e) => {
                    setGiftCard(null);
                    setGiftInput(e.target.value);
                  }}
                  aria-label="Gift card code"
                  autoCapitalize="characters"
                  placeholder="GIFT-XXXX-XXXX (optional)"
                  className={`${inputClass} uppercase`}
                />
                {giftCard ? (
                  <button type="button" onClick={() => setGiftCard(null)} className="btn-secondary shrink-0">
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={applyGiftCard}
                    disabled={checkingGift || giftInput.trim() === ""}
                    className="btn-secondary shrink-0"
                  >
                    {checkingGift ? "Checking…" : "Apply"}
                  </button>
                )}
              </div>
              {giftCard && (
                <p className="mt-1.5 text-xs font-semibold text-lime-ink">
                  Gift card applied: {formatPrice(giftCard.balanceCents)} on the card
                  {giftCard.balanceCents > giftCents &&
                    `, ${formatPrice(giftCard.balanceCents - giftCents)} stays on it for next time`}
                  .
                </p>
              )}
              {(giftMessage || state.giftCardError) && (
                <p className="mt-1.5 text-xs font-medium text-danger">{giftMessage ?? state.giftCardError}</p>
              )}
              {giftCard && <input type="hidden" name="giftCardCode" value={giftCard.code} />}
            </div>
          )}
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" error={errors.phone} hint="Optional" />
          {textsOn && (
            // Unticked by default: texts only go to clients who ask for them.
            <SmsConsent slug={slug} />
          )}
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
          {hasExtras ? (
            <button type="button" onClick={() => goTo("extras")} className="text-sm font-bold tracking-wider text-link uppercase hover:underline">
              ← Back to extras
            </button>
          ) : (
            <Link href={backHref} className="inline-block text-sm font-bold tracking-wider text-link uppercase hover:underline">
              ← Pick another time
            </Link>
          )}
        </div>
      </section>
    </form>
  );
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl font-bold sm:text-3xl">{children}</h2>;
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
