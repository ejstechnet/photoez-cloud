"use client";

import { useState } from "react";
import { MAX_STORAGE_BLOCKS, STORAGE_BLOCK_BYTES, STORAGE_BLOCK_PRICES, formatStorage, type Interval } from "@/lib/plans";
import { updateStorage } from "./actions";

// Billing > Extra storage: pick how many 500 GB blocks to pay for. The total
// and the price update as they choose; Stripe charges (or credits) the
// difference when they click Update storage.
export function StorageCard({
  current,
  planBytes,
  usedBytes,
  interval,
  renews,
  blocked,
}: {
  current: number;
  planBytes: number;
  usedBytes: number;
  interval: Interval;
  // "Renews on …" for an existing storage subscription.
  renews: string | null;
  // Why storage can't be bought right now (Free, trial, or no subscription).
  blocked: string | null;
}) {
  const [blocks, setBlocks] = useState(current);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const price = STORAGE_BLOCK_PRICES[interval] / 100;
  const per = interval === "year" ? "year" : "month";
  const total = planBytes + blocks * STORAGE_BLOCK_BYTES;
  // Can't remove space that's already in use.
  const smallest = Math.max(0, Math.ceil((usedBytes - planBytes) / STORAGE_BLOCK_BYTES));

  async function save() {
    setSaving(true);
    setMessage(null);
    const r = await updateStorage(blocks).catch(() => ({ error: "The connection dropped. Try again." }));
    setSaving(false);
    if ("error" in r) {
      setMessage({ text: r.error, error: true });
      return;
    }
    setMessage({
      text:
        blocks > current
          ? `Done! You now have ${formatStorage(total)} of storage.`
          : blocks === 0
            ? "Extra storage removed. The unused time is credited to your next bill."
            : `Done! You now have ${formatStorage(total)} of storage. The unused time is credited to your next bill.`,
      error: false,
    });
  }

  return (
    <section id="storage" className="card mt-8 scroll-mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Extra storage</h2>
        <span className="rounded-full bg-sky-light/60 px-3 py-1 text-xs font-bold tracking-wider uppercase">
          {formatStorage(STORAGE_BLOCK_BYTES)} for ${STORAGE_BLOCK_PRICES.month / 100}/mo
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Need more room than your plan includes? Add storage in {formatStorage(STORAGE_BLOCK_BYTES)} steps, and remove it
        any time you&rsquo;re using less. It&rsquo;s billed with your plan, on the same card.
      </p>

      {blocked ? (
        <p className="mt-4 rounded-xl bg-background px-4 py-3 text-sm font-semibold">{blocked}</p>
      ) : (
        <div className="mt-5 space-y-4">
          <label className="block max-w-sm">
            <span className="text-sm font-semibold">Extra storage</span>
            <select
              value={blocks}
              onChange={(e) => {
                setBlocks(Number(e.target.value));
                setMessage(null);
              }}
              className="mt-1.5 w-full rounded-xl border-2 border-border bg-surface px-3 py-2.5 font-semibold"
            >
              {Array.from({ length: MAX_STORAGE_BLOCKS + 1 }, (_, n) => (
                <option key={n} value={n} disabled={n < smallest}>
                  {n === 0 ? "None" : `+${formatStorage(n * STORAGE_BLOCK_BYTES)} ($${n * price}/${per})`}
                  {n < smallest ? " (in use)" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm">
            Total storage: <strong>{formatStorage(total)}</strong>{" "}
            <span className="text-muted">
              ({formatStorage(planBytes)} with your plan
              {blocks > 0 && ` + ${formatStorage(blocks * STORAGE_BLOCK_BYTES)} extra for $${blocks * price}/${per}`})
            </span>
          </p>
          {renews && current > 0 && <p className="text-xs text-muted">{renews}</p>}
          {message && (
            <p
              role={message.error ? "alert" : undefined}
              className={`rounded-xl px-3.5 py-2.5 text-sm font-medium ${message.error ? "bg-danger/10 text-danger" : "bg-lime/15"}`}
            >
              {message.text}
            </p>
          )}
          <button type="button" onClick={save} disabled={saving || blocks === current} className="btn-primary">
            {saving ? "Updating…" : blocks > current ? "Add storage" : blocks < current ? "Remove storage" : "Update storage"}
          </button>
          {blocks > current && (
            <p className="text-xs text-muted">
              {current === 0
                ? `Your card is charged $${blocks * price} today, then every ${per}.`
                : `Your card is charged today for the added storage for the rest of this billing period, then $${blocks * price} a ${per}.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
