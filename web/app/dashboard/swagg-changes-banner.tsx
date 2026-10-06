"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { SwaggChange } from "@/db/schema";
import { swaggChangeText } from "@/lib/email/messages";
import { dismissSwaggChanges, refreshSwagg } from "./store/actions";

// Shown on every dashboard page when SwaggPress changed products the studio
// sells (lib/swaggpress/catalog.ts). Price drops and new sizes wait for
// "Refresh prices"; increases were already applied and are just reported.
export function SwaggChangesBanner({ changes }: { changes: SwaggChange[] }) {
  const [open, setOpen] = useState(false);
  const [working, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const waiting = changes.some((c) => !c.applied);
  const count = (kind: SwaggChange["kind"]) => changes.filter((c) => c.kind === kind).length;
  const sizes = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;
  const parts = [
    count("down") && `lowered prices on ${sizes(count("down"))}`,
    count("new") && `added ${sizes(count("new"))}`,
    count("up") && `raised prices on ${sizes(count("up"))} (already updated)`,
    count("gone") && `stopped offering ${sizes(count("gone"))} (already hidden)`,
    count("details") && `updated photos or details on ${sizes(count("details"))}`,
  ].filter(Boolean) as string[];
  const summary = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];

  return (
    <div className="border-b border-lime/40 bg-lime/15 px-4 py-3 text-sm text-brand-deep">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1">
          <span className="font-bold">SwaggPress {summary}.</span>{" "}
          {waiting ? "Refresh to load the new prices. Your prices to clients stay the same unless you change them." : "Your prices to clients stay the same unless you change them."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="text-xs font-semibold underline underline-offset-4" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide changes" : "See what changed"}
          </button>
          {waiting ? (
            <button
              type="button"
              className="btn-primary px-4 py-2 text-xs"
              disabled={working}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const result = await refreshSwagg();
                  if (!result.ok) setError(result.message);
                })
              }
            >
              {working ? "Refreshing…" : "Refresh prices"}
            </button>
          ) : (
            <button type="button" className="btn-secondary px-4 py-2 text-xs" disabled={working} onClick={() => start(() => dismissSwaggChanges())}>
              Got it
            </button>
          )}
        </div>
      </div>
      {error && <p className="mx-auto mt-2 max-w-[1440px] text-xs font-semibold text-red-700">{error}</p>}
      {open && (
        <div className="mx-auto mt-3 max-w-[1440px]">
          <ul className="grid gap-1 sm:grid-cols-2">
            {changes.map((c, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="font-semibold">{c.label ? `${c.product} · ${c.label}` : c.product}:</span>
                <span>{swaggChangeText(c)}</span>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/store" className="mt-2 inline-block text-xs font-semibold underline underline-offset-4">
            Review my prices and profit
          </Link>
        </div>
      )}
    </div>
  );
}
