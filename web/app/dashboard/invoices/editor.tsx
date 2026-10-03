"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { FormError, inputClass } from "@/components/form";
import { formatPrice } from "@/lib/booking/format";
import { MAX_INSTALLMENTS, buildSchedule, formatDay, invoiceTotals, parseTaxRate, type Every } from "@/lib/invoices/math";
import { saveInvoice, type EditorInput } from "./actions";

type Row = { description: string; quantity: string; price: string };
export type EditorClient = { id: string; name: string; email: string | null; phone: string | null };

// The quote / invoice editor, like InvoiceEZ's: client, line items, tax, how
// it's paid (in full, a deposit, or a payment plan), an optional contract,
// notes, and terms. Totals and the payment schedule update as you type; the
// server works them out again when it saves.
export function InvoiceEditor({
  initial,
  clients,
  templates,
}: {
  initial: EditorInput;
  clients: EditorClient[];
  templates: { id: string; title: string }[];
}) {
  const [v, setV] = useState<EditorInput>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof EditorInput>(key: K, value: EditorInput[K]) => setV((old) => ({ ...old, [key]: value }));
  const setPlan = (patch: Partial<EditorInput["plan"]>) => setV((old) => ({ ...old, plan: { ...old.plan, ...patch } }));
  const setRow = (i: number, patch: Partial<Row>) => set("items", v.items.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const preview = useMemo(() => {
    const items = v.items
      .map((r) => ({
        description: r.description,
        quantity: Number(r.quantity || "1") || 0,
        unitCents: Math.round(Number(r.price.replace(/[$,]/g, "") || "0") * 100) || 0,
      }))
      .filter((r) => r.description || r.unitCents);
    const totals = invoiceTotals(items, parseTaxRate(v.taxRate) ?? 0);
    const p = v.plan;
    const schedule = buildSchedule(
      totals.totalCents,
      p.mode === "installments"
        ? { mode: "installments", depositPercent: p.depositPercent, count: p.count, every: p.every, firstDue: p.firstDue || new Date().toISOString().slice(0, 10) }
        : p.mode === "deposit"
          ? { mode: "deposit", depositPercent: p.depositPercent }
          : { mode: "full" },
      v.dueDate || null,
    );
    return { totals, schedule };
  }, [v.items, v.taxRate, v.plan, v.dueDate]);

  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    setV((old) => ({
      ...old,
      clientId: c?.id ?? null,
      clientName: c?.name ?? "",
      clientEmail: c?.email ?? "",
      clientPhone: c?.phone ?? "",
    }));
  };

  const save = (send: boolean) => {
    setMessage(null);
    if (send && !window.confirm(`Email this ${v.kind} to ${v.clientEmail || "the client"} now?`)) return;
    start(async () => {
      const result = await saveInvoice(v, send);
      if (result?.message) setMessage(result.message);
    });
  };

  const word = v.kind === "quote" ? "quote" : "invoice";
  const label = "text-sm font-semibold";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card space-y-4 p-6">
          <h2 className="font-display text-xl font-bold">Client</h2>
          {clients.length > 0 && (
            <label className="block">
              <span className={label}>Choose a client</span>
              <select value={v.clientId ?? ""} onChange={(e) => pickClient(e.target.value)} className={`mt-1.5 ${inputClass}`}>
                <option value="">New client (type their details below)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` · ${c.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={label}>Name</span>
              <input value={v.clientName} onChange={(e) => set("clientName", e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
            <label className="block">
              <span className={label}>Email</span>
              <input type="email" value={v.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
            <label className="block">
              <span className={label}>Phone</span>
              <input type="tel" value={v.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-display text-xl font-bold">Details</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <label className="block">
              <span className={label}>Title</span>
              <input
                value={v.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Wedding photography"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
            <label className="block">
              <span className={label}>Session or event date</span>
              <input type="date" value={v.eventDate} onChange={(e) => set("eventDate", e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </label>
          </div>

          <div>
            <p className={label}>Line items</p>
            <div className="mt-2 space-y-2">
              <div className="hidden grid-cols-[1fr_80px_120px_100px_32px] gap-2 text-xs font-bold tracking-wider text-muted uppercase sm:grid">
                <span>Description</span>
                <span>Qty</span>
                <span>Price</span>
                <span className="text-right">Amount</span>
                <span />
              </div>
              {v.items.map((row, i) => {
                const amount = Math.round((Number(row.quantity || "1") || 0) * (Number(row.price.replace(/[$,]/g, "") || "0") * 100 || 0));
                return (
                  <div key={i} className="grid grid-cols-[1fr_32px] gap-2 rounded-xl border border-border p-2 sm:grid-cols-[1fr_80px_120px_100px_32px] sm:items-center sm:border-0 sm:p-0">
                    <input
                      aria-label={`Line ${i + 1} description`}
                      value={row.description}
                      onChange={(e) => setRow(i, { description: e.target.value })}
                      placeholder="e.g. 8 hours of coverage"
                      className={`${inputClass} col-span-1`}
                    />
                    <button
                      type="button"
                      onClick={() => set("items", v.items.length > 1 ? v.items.filter((_, n) => n !== i) : [{ description: "", quantity: "1", price: "" }])}
                      aria-label={`Remove line ${i + 1}`}
                      className="row-start-1 grid size-8 place-items-center self-center justify-self-end rounded-full text-muted hover:bg-danger/10 hover:text-danger sm:col-start-5"
                    >
                      ✕
                    </button>
                    <div className="col-span-2 grid grid-cols-[80px_1fr_auto] items-center gap-2 sm:col-span-3 sm:col-start-2 sm:row-start-1 sm:grid-cols-[80px_120px_100px]">
                      <input
                        aria-label={`Line ${i + 1} quantity`}
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(e) => setRow(i, { quantity: e.target.value })}
                        className={inputClass}
                      />
                      <input
                        aria-label={`Line ${i + 1} price`}
                        inputMode="decimal"
                        value={row.price}
                        onChange={(e) => setRow(i, { price: e.target.value })}
                        placeholder="$0.00"
                        className={inputClass}
                      />
                      <span className="text-right font-semibold tabular-nums">{formatPrice(amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => set("items", [...v.items, { description: "", quantity: "1", price: "" }])}
              className="mt-3 text-sm font-bold text-lime-ink hover:underline"
            >
              + Add a line
            </button>
          </div>

          <label className="block max-w-[200px]">
            <span className={label}>Tax rate (%)</span>
            <input inputMode="decimal" value={v.taxRate} onChange={(e) => set("taxRate", e.target.value)} placeholder="0" className={`mt-1.5 ${inputClass}`} />
          </label>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-display text-xl font-bold">How the client pays</h2>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["full", "Paid in full", "One payment"],
                ["deposit", "Deposit + balance", "Deposit now, the rest later"],
                ["installments", "Payment plan", "Installments on set dates"],
              ] as const
            ).map(([mode, title, note]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={v.plan.mode === mode}
                onClick={() => setPlan({ mode })}
                className={`rounded-2xl border-2 p-3 text-left transition ${
                  v.plan.mode === mode ? "border-lime-ink bg-lime/15" : "border-border hover:border-lime-ink/50"
                }`}
              >
                <span className="block font-bold">{title}</span>
                <span className="block text-xs text-muted">{note}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {v.plan.mode !== "full" && (
              <label className="block">
                <span className={label}>Deposit (%)</span>
                <input
                  inputMode="numeric"
                  value={String(v.plan.depositPercent)}
                  onChange={(e) => setPlan({ depositPercent: Math.min(100, Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, "") || "0")))) })}
                  className={`mt-1.5 ${inputClass}`}
                />
              </label>
            )}
            {v.plan.mode === "installments" ? (
              <>
                <label className="block">
                  <span className={label}>Number of payments</span>
                  <select value={v.plan.count} onChange={(e) => setPlan({ count: Number(e.target.value) })} className={`mt-1.5 ${inputClass}`}>
                    {Array.from({ length: MAX_INSTALLMENTS }, (_, n) => n + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={label}>How often</span>
                  <select value={v.plan.every} onChange={(e) => setPlan({ every: e.target.value as Every })} className={`mt-1.5 ${inputClass}`}>
                    <option value="month">Monthly</option>
                    <option value="2weeks">Every 2 weeks</option>
                    <option value="week">Weekly</option>
                  </select>
                </label>
                <label className="block">
                  <span className={label}>First payment due</span>
                  <input type="date" value={v.plan.firstDue} onChange={(e) => setPlan({ firstDue: e.target.value })} className={`mt-1.5 ${inputClass}`} />
                </label>
              </>
            ) : (
              <label className="block">
                <span className={label}>{v.plan.mode === "deposit" ? "Balance due" : "Due date"}</span>
                <input type="date" value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={`mt-1.5 ${inputClass}`} />
              </label>
            )}
          </div>
          <p className="text-xs text-muted">
            Clients pay online by card through your Stripe account, and get an email reminder 3 days before each payment is due.
            {v.plan.mode === "installments" && " They can always pay more, or the whole balance, early."}
          </p>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-display text-xl font-bold">Contract, notes &amp; terms</h2>
          <label className="block">
            <span className={label}>Contract to sign</span>
            <select
              value={v.contractTemplateId ?? ""}
              onChange={(e) => set("contractTemplateId", e.target.value || null)}
              className={`mt-1.5 ${inputClass}`}
            >
              <option value="">No contract</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-muted">
              The client signs it before paying{v.kind === "quote" ? ", right after approving the quote" : ""}.{" "}
              <Link href="/dashboard/bookings/setup#contracts" className="link">
                Manage contracts
              </Link>
            </span>
          </label>
          <label className="block">
            <span className={label}>Notes to the client</span>
            <textarea rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} className={`mt-1.5 ${inputClass}`} />
          </label>
          <label className="block">
            <span className={label}>Terms</span>
            <textarea rows={4} value={v.terms} onChange={(e) => set("terms", e.target.value)} className={`mt-1.5 ${inputClass}`} />
          </label>
        </section>
      </div>

      <aside className="card space-y-4 p-6 lg:sticky lg:top-6">
        <h2 className="font-display text-xl font-bold">Summary</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(preview.totals.subtotalCents)}</dd>
          </div>
          {preview.totals.taxCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Tax</dt>
              <dd className="tabular-nums">{formatPrice(preview.totals.taxCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-display text-xl font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(preview.totals.totalCents)}</dd>
          </div>
        </dl>
        {preview.schedule.length > 0 && (
          <div>
            <p className="text-xs font-bold tracking-wider text-muted uppercase">Payments</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {preview.schedule.map((p, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {p.label}
                    <span className="block text-xs text-muted">
                      {p.dueDate ? `Due ${formatDay(p.dueDate, "short")}` : p.label === "Deposit" ? `Due when ${v.kind === "quote" ? "approved" : "received"}` : "No set date"}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatPrice(p.amountCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <FormError message={message} />
        <div className="space-y-2">
          <button type="button" onClick={() => save(true)} disabled={pending} className="btn-primary w-full">
            {pending ? "Saving…" : `Save & send ${word}`}
          </button>
          <button type="button" onClick={() => save(false)} disabled={pending} className="btn-secondary w-full">
            {initial.id ? "Save changes" : "Save as draft"}
          </button>
        </div>
      </aside>
    </div>
  );
}
