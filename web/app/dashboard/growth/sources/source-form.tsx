"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, SelectField, TextAreaField } from "@/components/form";
import { GROWTH_PLATFORMS } from "@/lib/growth/constants";
import type { SourceInput } from "@/lib/growth/sources";
import { PLATFORM_LABELS } from "../labels";
import { checkFeedNow, removeSource, saveSourceAction, type SourceFormState } from "./actions";

// Adding or editing one source: a feed read automatically, or a search /
// community Elle uses herself, with that community's rules.
export function SourceForm({ id, initial, submitLabel }: { id: string | null; initial: SourceInput; submitLabel: string }) {
  const [state, formAction, pending] = useActionState<SourceFormState, FormData>(saveSourceAction.bind(null, id), {});
  const v = state.values ?? initial;
  const p = state.problems ?? {};
  const isFeed = v.kind === "rss";

  return (
    <form key={state.attempt ?? 0} action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="kind" value={v.kind} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={v.name} error={p.name} placeholder={isFeed ? "Google Alert: deliver photos" : "Photo Biz Owners (Facebook group)"} />
        <SelectField label="Where" name="platform" defaultValue={v.platform} error={p.platform}>
          {GROWTH_PLATFORMS.map((pl) => (
            <option key={pl} value={pl}>
              {PLATFORM_LABELS[pl]}
            </option>
          ))}
        </SelectField>
      </div>
      {isFeed ? (
        <>
          <Field
            label="Feed address"
            name="feedUrl"
            type="url"
            defaultValue={v.feedUrl}
            error={p.feedUrl}
            placeholder="https://www.google.com/alerts/feeds/…"
            hint="Read automatically every 6 hours."
          />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="filter" value="keywords" defaultChecked={v.filter === "keywords"} className="mt-1" />
            <span>
              Only keep posts that match my phrases or names like Pixieset and HoneyBook.{" "}
              <span className="text-muted">Use this for a feed of every new thread; leave it off for Google Alerts, which already search.</span>
            </span>
          </label>
        </>
      ) : (
        <Field
          label="Search to open (optional)"
          name="searchUrl"
          type="url"
          defaultValue={v.searchUrl}
          error={p.searchUrl}
          placeholder="https://www.facebook.com/search/top?q=…"
          hint="Shows as a one-click button on the Growth page. Run it, then save good posts with the bookmark."
        />
      )}
      <fieldset className="space-y-2 rounded-xl border-2 border-border p-4">
        <legend className="px-1 text-sm font-semibold">The community&apos;s rules (every draft follows them)</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="linksAllowed" defaultChecked={v.linksAllowed} /> Links are allowed
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="selfPromoAllowed" defaultChecked={v.selfPromoAllowed} /> Mentioning your own product is allowed
        </label>
        <Field label="Disclosure line" name="disclosure" defaultValue={v.disclosure} error={p.disclosure} hint="Added to any reply that mentions PhotoEZ." />
        <TextAreaField label="Notes" name="rulesNote" rows={2} defaultValue={v.rulesNote ?? ""} error={p.rulesNote} />
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={v.enabled} /> On
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : state.saved ? "Saved ✓" : submitLabel}
        </button>
        {id && isFeed && <CheckNow id={id} />}
        {id && <DeleteSource id={id} />}
      </div>
    </form>
  );
}

function CheckNow({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setMessage((await checkFeedNow(id)).message))}
        className="btn-secondary"
      >
        {pending ? "Checking… (scoring can take a minute)" : "Check now"}
      </button>
      {message && <span className="text-sm text-muted">{message}</span>}
    </>
  );
}

function DeleteSource({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Delete this source? Posts already found through it stay.")) startTransition(() => removeSource(id));
      }}
      className="text-sm font-semibold text-danger hover:underline"
    >
      Delete
    </button>
  );
}
