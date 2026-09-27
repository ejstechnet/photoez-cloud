"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { saveDirectoryListing } from "./actions";

// Settings > Photographer directory: opt in to /photographers, where people
// search for photographers near them. Inquiries from it land in Inquiries.
export function DirectoryCard({
  listed,
  zip,
  place,
  steps,
}: {
  listed: boolean;
  zip: string;
  // "Seattle, WA" once a ZIP is saved.
  place: string | null;
  steps: { done: boolean; label: string; href: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveDirectoryListing, {});
  const missing = steps.filter((s) => !s.done && s.href !== "#directory");
  return (
    <section id="directory" className="card scroll-mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Photographer directory</h2>
        {listed && missing.length === 0 && (
          <span className="rounded-full bg-lime/25 px-3 py-1 text-xs font-bold tracking-wider text-lime-ink uppercase">
            Listed
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Free leads: people searching{" "}
        <Link href="/photographers" className="link" target="_blank">
          PhotoEZ Cloud&rsquo;s directory
        </Link>{" "}
        for a photographer near them can find your studio page, and their messages land in Inquiries. It&rsquo;s
        included on every plan.
      </p>

      {missing.length > 0 && (
        <div className="mt-4 rounded-xl bg-sky-light/40 px-4 py-3 text-sm">
          <p className="font-semibold">Before you&rsquo;re listed, finish your studio page:</p>
          <ul className="mt-2 space-y-1">
            {missing.map((step) => (
              <li key={step.label}>
                ○{" "}
                <Link href={step.href} className="link">
                  {step.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={formAction} className="mt-5 space-y-4">
        <Field
          label="Studio ZIP code"
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={10}
          defaultValue={zip}
          hint={place ? `Shown as ${place}. Clients search by distance from here.` : "Where you're based. Only your city is shown."}
          error={state.errors?.zip}
        />
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" name="listed" defaultChecked={listed} className="size-5 accent-[var(--lime)]" />
          List my studio in the directory
        </label>
        <FormError message={state.message} />
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pending={pending} fullWidth={false}>
            Save
          </SubmitButton>
          {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
          {listed && zip && (
            <Link href={`/photographers?q=${zip}`} target="_blank" className="link text-sm">
              See how you appear
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
