"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { saveStoreSettings } from "./actions";

// Store > Settings: open the shop, flat shipping per order, optional handling.
export function StoreSettingsForm({
  enabled,
  shippingCents,
  handlingCents,
}: {
  enabled: boolean;
  shippingCents: number;
  handlingCents: number;
}) {
  const [state, formAction, pending] = useActionState(saveStoreSettings, {});
  return (
    <form action={formAction} className="space-y-5">
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-5 accent-[var(--lime)]" />
        Open my store in delivered galleries
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Shipping per order ($)"
          name="shipping"
          inputMode="decimal"
          defaultValue={(shippingCents / 100).toString()}
          hint="Paid by the client. 0 = free shipping."
        />
        <Field
          label="Handling fee per order ($)"
          name="handling"
          inputMode="decimal"
          defaultValue={(handlingCents / 100).toString()}
          hint="Optional. Leave 0 for none."
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
  );
}
