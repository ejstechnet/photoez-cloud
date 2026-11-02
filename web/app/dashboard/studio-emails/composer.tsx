"use client";

import { useState, useTransition } from "react";
import { Field, FormError, SelectField, TextAreaField, inputClass } from "@/components/form";
import { renderEmail, type EmailLogo } from "@/lib/email/layout";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  FILL_INS,
  checkDraft,
  inAudience,
  studioEmailContent,
  studioEmailFooter,
  unknownFillIns,
  type Audience,
  type Draft,
  type DraftErrors,
  type StudioRow,
} from "@/lib/studio-emails";
import { deleteTemplate, saveTemplate, sendTestEmail, sendToStudios, type ActionResult } from "./actions";

type Template = Draft & { id: string; name: string };

const EMPTY: Draft = { subject: "", heading: "", body: "", buttonLabel: "", buttonUrl: "" };
const pick = (t: Template): Draft => ({ subject: t.subject, heading: t.heading, body: t.body, buttonLabel: t.buttonLabel, buttonUrl: t.buttonUrl });

// Write an email (from a template or from scratch), choose studios, preview
// it as each one will see it, then send a test or send it for real.
export function Composer({ studios, templates, logo }: { studios: StudioRow[]; templates: Template[]; logo: EmailLogo }) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [name, setName] = useState(templates[0]?.name ?? "");
  const [draft, setDraft] = useState<Draft>(templates[0] ? pick(templates[0]) : EMPTY);
  const [audience, setAudience] = useState<Audience>("all");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string>("");
  const [result, setResult] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();

  const set = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));
  const errors: DraftErrors = result.errors ?? {};
  const unknown = unknownFillIns(`${draft.subject} ${draft.heading} ${draft.body} ${draft.buttonLabel}`);

  // The group, narrowed by the search box; studios who unsubscribed can't be ticked.
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = studios.filter(
    (s) => inAudience(s, audience) && words.every((w) => `${s.name} ${s.businessName ?? ""} ${s.email}`.toLowerCase().includes(w)),
  );
  const sendable = shown.filter((s) => !s.optedOut);
  const chosenStudios = studios.filter((s) => chosen.has(s.id));

  // Preview as the chosen studio picked in the menu, else the first chosen, else a sample.
  const sample = studios.find((s) => s.id === previewId) ?? chosenStudios[0] ?? studios[0];
  const previewAs = sample ?? { name: "Maria Lopez", businessName: "Sunny Day Photo", email: "maria@example.com" };
  const previewHtml = renderEmail(studioEmailContent({ ...draft, subject: draft.subject || "(no subject)" }, previewAs), {
    studioName: "PhotoEZ Cloud",
    footer: studioEmailFooter("https://photoezcloud.com/unsubscribe/…"),
    logo,
  }).html;

  function loadTemplate(id: string) {
    setTemplateId(id);
    setResult({});
    const t = templates.find((x) => x.id === id);
    setName(t?.name ?? "");
    setDraft(t ? pick(t) : EMPTY);
  }

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const run = (work: () => Promise<ActionResult>) => startTransition(async () => setResult(await work()));

  function send() {
    const problems = checkDraft(draft);
    if (Object.keys(problems).length) return setResult({ errors: problems });
    if (chosen.size === 0) return setResult({ error: "Choose at least one studio." });
    const who = chosen.size === 1 ? `1 studio (${chosenStudios[0]?.email})` : `${chosen.size} studios`;
    if (!confirm(`Send "${draft.subject}" to ${who}? This can't be undone.`)) return;
    run(async () => {
      const r = await sendToStudios(draft, [...chosen], templates.find((t) => t.id === templateId)?.name ?? null);
      if (r.ok) setChosen(new Set());
      return r;
    });
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      {/* 1. The email */}
      <section className="card space-y-4 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-bold">1. Write it</h2>
        <SelectField label="Start from a template" value={templateId} onChange={(e) => loadTemplate(e.target.value)}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="">Start from scratch</option>
        </SelectField>
        <Field label="Subject" value={draft.subject} onChange={(e) => set({ subject: e.target.value })} error={errors.subject} />
        <Field
          label="Heading"
          hint="Optional. The big title at the top of the email."
          value={draft.heading}
          onChange={(e) => set({ heading: e.target.value })}
          error={errors.heading}
        />
        <TextAreaField
          label="Message"
          hint="Leave a blank line between paragraphs. Links become clickable. Put {button} on a line of its own to place the button there (otherwise it goes at the end)."
          rows={12}
          value={draft.body}
          onChange={(e) => set({ body: e.target.value })}
          error={errors.body}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Button text"
            hint="Optional"
            value={draft.buttonLabel}
            onChange={(e) => set({ buttonLabel: e.target.value })}
            error={errors.buttonLabel}
          />
          <Field
            label="Button opens"
            placeholder="https://photoezcloud.com/…"
            value={draft.buttonUrl}
            onChange={(e) => set({ buttonUrl: e.target.value })}
            error={errors.buttonUrl}
          />
        </div>
        <p className="text-sm text-muted">
          Fill-ins, swapped for each studio:{" "}
          {FILL_INS.map((f) => (
            <code key={f} className="mr-1.5 rounded bg-background px-1.5 py-0.5 text-xs">{`{${f}}`}</code>
          ))}
        </p>
        {unknown.length > 0 && (
          <p className="rounded-xl bg-sun/25 px-3.5 py-2.5 text-sm">
            Not a fill-in, so it will show as typed: {unknown.map((u) => `{${u}}`).join(", ")}
          </p>
        )}

        <div className="border-t border-border pt-4">
          <p className="text-sm font-semibold">Save as a template</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              aria-label="Template name"
              placeholder="Template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} max-w-xs flex-1`}
            />
            {templateId && (
              <button
                type="button"
                disabled={pending}
                className="btn-secondary"
                onClick={() => run(() => saveTemplate(templateId, name, draft))}
              >
                Update template
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              className="btn-secondary"
              onClick={() =>
                run(async () => {
                  const r = await saveTemplate(null, name, draft);
                  if (r.id) setTemplateId(r.id);
                  return r;
                })
              }
            >
              Save as new
            </button>
            {templateId && (
              <button
                type="button"
                disabled={pending}
                className="text-xs font-bold tracking-wider text-danger uppercase hover:underline"
                onClick={() => {
                  if (!confirm(`Delete the "${templates.find((t) => t.id === templateId)?.name}" template?`)) return;
                  run(async () => {
                    const r = await deleteTemplate(templateId);
                    setTemplateId("");
                    return r;
                  });
                }}
              >
                Delete template
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="space-y-8">
        {/* 2. Who gets it */}
        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold">2. Choose studios</h2>
            <p className="text-sm font-semibold text-lime-ink">{chosen.size} chosen</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectField label="Group" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABELS[a]} ({studios.filter((s) => inAudience(s, a)).length})
                </option>
              ))}
            </SelectField>
            <Field label="Search" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="mt-3 flex gap-4 text-xs font-bold tracking-wider uppercase">
            <button
              type="button"
              className="text-link hover:underline"
              onClick={() => setChosen((c) => new Set([...c, ...sendable.map((s) => s.id)]))}
            >
              Choose all {sendable.length} shown
            </button>
            <button type="button" className="text-muted hover:text-foreground" onClick={() => setChosen(new Set())}>
              Clear
            </button>
          </div>
          <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-2xl border border-border">
            {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No studios in this group.</li>}
            {shown.map((s) => (
              <li key={s.id}>
                <label className={`flex items-center gap-3 px-4 py-2.5 ${s.optedOut ? "opacity-60" : "cursor-pointer hover:bg-background/60"}`}>
                  <input
                    type="checkbox"
                    disabled={s.optedOut}
                    checked={chosen.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="accent-lime-ink"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.businessName || s.name}</span>
                    <span className="block truncate text-xs text-muted">{s.email}</span>
                  </span>
                  {s.optedOut && <span className="text-[11px] font-bold tracking-wider text-muted uppercase">Unsubscribed</span>}
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. What they'll see */}
        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">3. Preview</h2>
            {chosenStudios.length > 1 && (
              <label className="text-sm">
                <span className="sr-only">Preview as</span>
                <select value={sample?.id ?? ""} onChange={(e) => setPreviewId(e.target.value)} className={`${inputClass} py-1.5 text-sm`}>
                  {chosenStudios.map((s) => (
                    <option key={s.id} value={s.id}>
                      As {s.businessName || s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            Exactly what {sample ? sample.businessName || sample.name : "a studio"} will get, with their own unsubscribe link.
          </p>
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            sandbox=""
            className="mt-4 h-[560px] w-full rounded-2xl border border-border bg-[#eceff5]"
          />
          <FormError message={result.error} />
          {result.ok && (
            <p role="status" className="mt-3 rounded-xl bg-lime/15 px-3.5 py-2.5 text-sm font-semibold text-lime-ink">
              {result.ok}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              className="btn-secondary"
              onClick={() => run(() => sendTestEmail(draft, chosenStudios[0]?.id ?? null))}
            >
              Send me a test
            </button>
            <button type="button" disabled={pending || chosen.size === 0} className="btn-primary" onClick={send}>
              {pending ? "Please wait…" : `Send to ${chosen.size === 1 ? "1 studio" : `${chosen.size} studios`}`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
