"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { SessionPicker } from "./session-picker";
import type { StoreVariant } from "@/db/schema";
import { MAX_VARIANTS } from "@/lib/store/rules";
import type { ProductFormState } from "./actions";

// Size name, price, width, height, Remove.
const ROW = "sm:grid-cols-[1fr_6rem_5.5rem_5.5rem_5rem]";

type Row = { id: string; label: string; price: string; width: string; height: string };

const toRow = (v: StoreVariant): Row => ({
  id: v.id,
  label: v.label,
  price: (v.priceCents / 100).toString(),
  width: v.widthIn?.toString() ?? "",
  height: v.heightIn?.toString() ?? "",
});

// Add/edit a store product: its name and its sizes with prices. A size with
// a width and height is cropped to that shape; without, it isn't.
export function ProductForm({
  action,
  defaultValues,
  sessions,
  submitLabel,
}: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  defaultValues?: { name: string; description: string | null; active: boolean; variants: StoreVariant[]; sessionTypeIds?: string[] };
  // The studio's session types, for "Show in galleries for".
  sessions: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [rows, setRows] = useState<Row[]>(
    defaultValues?.variants.length ? defaultValues.variants.map(toRow) : [{ id: "", label: "", price: "", width: "", height: "" }],
  );
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const small = `${inputClass} px-3`;
  const mobileLabel = "mb-1 block text-xs font-bold tracking-wider text-muted uppercase sm:hidden";

  return (
    <form action={formAction} className="space-y-5">
      <Field label="Product name" name="name" defaultValue={defaultValues?.name} placeholder="Photo Prints" required />
      <Field
        label="Short description"
        name="description"
        defaultValue={defaultValues?.description ?? ""}
        placeholder="Printed on lustre photo paper"
        hint="Optional. Shown to clients under the name."
      />

      <fieldset>
        <legend className="text-sm font-semibold">Sizes and prices</legend>
        <p className="mt-1 text-xs text-muted">
          The name clients see and your price. Width and height are optional: fill them in for prints and canvases so clients crop their photo to that shape, and leave them blank for things like tees and mugs.
        </p>
        {/* Column names on wider screens; on phones each box has its own label. */}
        <div className={`mt-3 hidden gap-2 text-xs font-bold tracking-wider text-muted uppercase sm:grid ${ROW}`}>
          <span>Size name</span>
          <span>Price ($)</span>
          <span>Width (in)</span>
          <span>Height (in)</span>
          <span />
        </div>
        <div className="mt-2 space-y-3 sm:space-y-2">
          {rows.map((row, i) => (
            <div key={i} className={`grid grid-cols-2 gap-2 border-b border-border pb-3 sm:border-0 sm:pb-0 ${ROW}`}>
              <input type="hidden" name="variantId" value={row.id} />
              <label className="col-span-2 block sm:col-span-1">
                <span className={mobileLabel}>Size name</span>
                <input name="variantLabel" value={row.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="8×10" aria-label="Size name" className={small} />
              </label>
              <label className="block">
                <span className={mobileLabel}>Price ($)</span>
                <input name="variantPrice" value={row.price} onChange={(e) => set(i, { price: e.target.value })} placeholder="30" inputMode="decimal" aria-label="Price in dollars" className={small} />
              </label>
              <label className="block">
                <span className={mobileLabel}>Width (in)</span>
                <input name="variantWidth" value={row.width} onChange={(e) => set(i, { width: e.target.value })} placeholder="Optional" inputMode="decimal" aria-label="Width in inches (optional)" className={small} />
              </label>
              <label className="block">
                <span className={mobileLabel}>Height (in)</span>
                <input name="variantHeight" value={row.height} onChange={(e) => set(i, { height: e.target.value })} placeholder="Optional" inputMode="decimal" aria-label="Height in inches (optional)" className={small} />
              </label>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                disabled={rows.length === 1}
                className="col-span-2 justify-self-end rounded-xl px-2 text-sm font-semibold text-danger disabled:opacity-30 sm:col-span-1 sm:self-center"
                aria-label="Remove size"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {rows.length < MAX_VARIANTS && (
          <button
            type="button"
            className="mt-3 text-sm font-bold tracking-wider text-link uppercase hover:underline"
            onClick={() => setRows([...rows, { id: "", label: "", price: "", width: "", height: "" }])}
          >
            + Add a size
          </button>
        )}
      </fieldset>

      <SessionPicker sessions={sessions} selected={defaultValues?.sessionTypeIds ?? []} />
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} className="size-4 accent-lime-ink" />
        Show in my store
      </label>
      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
        <Link href="/dashboard/store" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
