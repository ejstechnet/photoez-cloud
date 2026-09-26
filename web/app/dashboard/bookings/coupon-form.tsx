"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormError, SelectField, SubmitButton } from "@/components/form";
import type { CouponFormState } from "./coupon-actions";

export type CouponValues = {
  code: string;
  kind: "percent" | "amount";
  value: number;
  sessionTypeIds: string[];
  startsOn: string | null;
  endsOn: string | null;
  maxUses: number | null;
  maxUsesPerClient: number | null;
  active: boolean;
};

// Add/edit form for a coupon code.
export function CouponForm({
  action,
  sessions,
  defaultValues,
  submitLabel,
}: {
  action: (state: CouponFormState, formData: FormData) => Promise<CouponFormState>;
  sessions: { id: string; name: string }[];
  defaultValues?: CouponValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [kind, setKind] = useState(defaultValues?.kind ?? "percent");
  const [some, setSome] = useState((defaultValues?.sessionTypeIds.length ?? 0) > 0);
  const errors = state.errors ?? {};
  const value = defaultValues
    ? defaultValues.kind === "percent"
      ? String(defaultValues.value)
      : (defaultValues.value / 100).toFixed(defaultValues.value % 100 ? 2 : 0)
    : "";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label="Code"
        name="code"
        defaultValue={defaultValues?.code}
        error={errors.code}
        placeholder="SPRING20"
        hint="What clients type on the booking form. Capital letters don't matter."
        style={{ textTransform: "uppercase" }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Discount" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "percent" | "amount")}>
          <option value="percent">Percent off (%)</option>
          <option value="amount">Dollars off ($)</option>
        </SelectField>
        <Field
          label={kind === "percent" ? "Percent off" : "Dollars off"}
          name="value"
          inputMode="decimal"
          defaultValue={value}
          error={errors.value}
          placeholder={kind === "percent" ? "20" : "25"}
        />
      </div>
      <p className="-mt-1 text-xs text-muted">Taken off the whole total: the session plus any extras.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" name="startsOn" type="date" defaultValue={defaultValues?.startsOn ?? ""} hint="Optional" />
        <Field label="Ends" name="endsOn" type="date" defaultValue={defaultValues?.endsOn ?? ""} error={errors.endsOn} hint="Last day it works" />
        <Field
          label="Total number of uses"
          name="maxUses"
          type="number"
          min={1}
          defaultValue={defaultValues?.maxUses ?? ""}
          error={errors.maxUses}
          hint="All clients together. Blank = no limit"
        />
        <Field
          label="Uses per client"
          name="maxUsesPerClient"
          type="number"
          min={1}
          defaultValue={defaultValues?.maxUsesPerClient ?? ""}
          error={errors.maxUsesPerClient}
          hint="Matched by email. 1 = once each. Blank = no limit"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Works for</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="appliesTo" value="all" checked={!some} onChange={() => setSome(false)} className="accent-lime-ink" />
            Every session
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="appliesTo" value="some" checked={some} onChange={() => setSome(true)} className="accent-lime-ink" />
            Only some sessions
          </label>
        </div>
        {some && (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2 rounded-xl border-2 border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="sessionTypeIds"
                    value={s.id}
                    defaultChecked={defaultValues?.sessionTypeIds.includes(s.id)}
                    className="size-4 accent-lime-ink"
                  />
                  {s.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        {errors.sessions && <p className="mt-1.5 text-xs font-medium text-danger">{errors.sessions}</p>}
      </fieldset>

      <label className="flex items-center gap-3 rounded-xl border-2 border-border px-3.5 py-3">
        <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} className="size-4 accent-lime-ink" />
        <span className="text-sm font-semibold">Active (clients can use it)</span>
      </label>

      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
        <Link
          href="/dashboard/bookings/setup#coupons"
          className="text-center text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
