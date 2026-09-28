"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import type { StoreVariant } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import type { ProductFormState } from "./actions";

// A SwaggPress product's page: its sizes come from SwaggPress, and the
// studio sets its own price for each, with the profit shown as they type.
export function SwaggPricesForm({
  action,
  defaultValues,
}: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  defaultValues: { name: string; description: string | null; active: boolean; variants: StoreVariant[] };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(defaultValues.variants.map((v) => [v.id, (v.priceCents / 100).toString()])),
  );
  const cents = (text: string) => Math.round(Number(text.replace(/^\$/, "")) * 100);

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Product name" name="name" defaultValue={defaultValues.name} required />
      <Field label="Short description" name="description" defaultValue={defaultValues.description ?? ""} hint="Optional. Shown to clients under the name." />
      <fieldset>
        <legend className="text-sm font-semibold">Your prices</legend>
        <p className="mt-1 text-xs text-muted">
          Wholesale is what SwaggPress charges your card; the rest is yours. Sizes and wholesale prices update from SwaggPress
          automatically.
        </p>
        <div className="mt-3 hidden grid-cols-[1fr_6rem_7rem_6rem] gap-3 text-xs font-bold tracking-wider text-muted uppercase sm:grid">
          <span>Size</span>
          <span>Wholesale</span>
          <span>Your price ($)</span>
          <span>Profit</span>
        </div>
        <ul className="mt-2 space-y-2">
          {defaultValues.variants.map((v) => {
            const price = cents(prices[v.id] ?? "");
            const profit = Number.isFinite(price) && v.wholesaleCents != null ? price - v.wholesaleCents : null;
            const gone = v.available === false;
            return (
              <li key={v.id} className={`grid grid-cols-2 items-center gap-3 rounded-xl border-2 border-border p-3 sm:grid-cols-[1fr_6rem_7rem_6rem] sm:border-0 sm:p-0 ${gone ? "opacity-60" : ""}`}>
                <span className="col-span-2 font-semibold sm:col-span-1">
                  {v.label}
                  {gone && <span className="ml-2 text-xs font-bold text-danger uppercase">No longer offered</span>}
                </span>
                <span className="text-sm">
                  <span className="text-xs text-muted sm:hidden">Wholesale </span>
                  {v.wholesaleCents != null ? formatPrice(v.wholesaleCents) : "—"}
                </span>
                <input
                  name={`variantPrice.${v.id}`}
                  value={prices[v.id] ?? ""}
                  onChange={(e) => setPrices({ ...prices, [v.id]: e.target.value })}
                  inputMode="decimal"
                  aria-label={`Your price for ${v.label}`}
                  className={`${inputClass} px-3`}
                  disabled={gone}
                />
                <span className={`text-sm font-semibold ${profit !== null && profit <= 0 ? "text-danger" : "text-lime-ink"}`}>
                  <span className="text-xs font-normal text-muted sm:hidden">Profit </span>
                  {profit === null ? "—" : profit <= 0 ? "Too low" : formatPrice(profit)}
                </span>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={defaultValues.active} className="size-4 accent-lime-ink" />
        Show in my store
      </label>
      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          Save prices
        </SubmitButton>
        <Link href="/dashboard/store" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
