"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormError, SubmitButton } from "@/components/form";
import { RichTextField } from "@/components/rich-text-editor";
import { PLACEHOLDERS } from "@/lib/contracts/placeholders";
import type { ContractFormState } from "./contract-actions";

// Add/edit form for a contract template, with the fill-in tags listed so
// they can be copied into the text.
export function ContractForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: ContractFormState, formData: FormData) => Promise<ContractFormState>;
  defaultValues?: { title: string; content: string; isDefault: boolean };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [copied, setCopied] = useState<string | null>(null);
  const errors = state.errors ?? {};

  async function copy(tag: string) {
    await navigator.clipboard.writeText(`{{${tag}}}`);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label="Title" name="title" defaultValue={defaultValues?.title} error={errors.title} required />

      <div className="rounded-2xl bg-sky-light/40 p-4">
        <p className="text-sm font-semibold">Fill-in tags</p>
        <p className="text-xs text-muted">
          Click a tag to copy it, then paste it into the contract. It&apos;s replaced with the booking&apos;s details.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(PLACEHOLDERS).map(([tag, meaning]) => (
            <button
              key={tag}
              type="button"
              onClick={() => copy(tag)}
              title={meaning}
              className="rounded-lg border border-brand/20 bg-surface px-2 py-1 font-mono text-[11px] transition hover:border-lime-ink"
            >
              {copied === tag ? "Copied!" : `{{${tag}}}`}
            </button>
          ))}
        </div>
      </div>

      <RichTextField label="Contract" name="content" defaultValue={defaultValues?.content ?? ""} error={errors.content} />

      <label className="flex items-start gap-3 rounded-xl border-2 border-border px-3.5 py-3">
        <input type="checkbox" name="isDefault" defaultChecked={defaultValues?.isDefault ?? false} className="mt-1 size-4 accent-lime-ink" />
        <span>
          <span className="block text-sm font-semibold">Use as my default contract</span>
          <span className="block text-xs text-muted">Sent for every session unless a session picks another contract or none.</span>
        </span>
      </label>

      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} fullWidth={false}>
          {submitLabel}
        </SubmitButton>
        <Link
          href="/dashboard/bookings/setup#contracts"
          className="text-center text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
