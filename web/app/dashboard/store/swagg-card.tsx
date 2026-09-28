"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FormError, SubmitButton, inputClass } from "@/components/form";
import { connectSwagg, disconnectSwagg, refreshSwagg } from "./actions";

// Store > SwaggPress Creations: connect with the partner API key from
// swaggpress.com, see the account, and browse the catalog.
export function SwaggCard({
  business,
  cardOnFile,
  syncedAt,
}: {
  // Null when not connected.
  business: string | null;
  cardOnFile: boolean;
  syncedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(connectSwagg, {});
  const [working, start] = useTransition();
  const [refreshed, setRefreshed] = useState<{ message: string; ok: boolean } | null>(null);
  return (
    <section className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">SwaggPress Creations</h2>
        {business && (
          <span className="rounded-full bg-lime/25 px-3 py-1 text-xs font-bold tracking-wider text-lime-ink uppercase">Connected</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Our print and merch partner prints your clients&rsquo; photos and presses tees, hoodies, tumblers, and more, then ships
        straight to them. You set your prices; SwaggPress charges your card on file its wholesale price when an order comes in.
      </p>

      {business ? (
        <div className="mt-5 space-y-3 text-sm">
          <p>
            Connected as <strong>{business}</strong>.
          </p>
          {!cardOnFile && (
            <p className="rounded-xl bg-sun/30 px-4 py-3 font-semibold">
              Add a card on file at{" "}
              <a href="https://swaggpress.com/public/account/partner.php" target="_blank" rel="noopener" className="link">
                swaggpress.com
              </a>{" "}
              (My Account → Photographer Partner). Until then, SwaggPress products stay hidden from your clients.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/dashboard/store/swaggpress" className="btn-primary px-4 py-2 text-xs">
              Browse the catalog
            </Link>
            <button type="button" className="btn-secondary px-4 py-2 text-xs" disabled={working} onClick={() => start(async () => setRefreshed(await refreshSwagg()))}>
              {working ? "Refreshing…" : "Refresh prices"}
            </button>
            <button
              type="button"
              className="text-xs font-bold tracking-wider text-danger uppercase hover:underline"
              disabled={working}
              onClick={() => confirm("Disconnect SwaggPress? Its products will be hidden from your store until you connect again.") && start(() => disconnectSwagg())}
            >
              Disconnect
            </button>
          </div>
          {refreshed && (
            <p className={`text-sm font-semibold ${refreshed.ok ? "text-lime-ink" : "text-danger"}`}>{refreshed.message}</p>
          )}
          {syncedAt && <p className="text-xs text-muted">Prices and sizes last updated {syncedAt}.</p>}
        </div>
      ) : (
        <form action={formAction} className="mt-5 space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              At{" "}
              <a href="https://swaggpress.com/public/account/partner.php" target="_blank" rel="noopener" className="link">
                swaggpress.com
              </a>
              , go to My Account → Photographer Partner, join, and save a card.
            </li>
            <li>Copy your API key (it starts with spk_) and paste it here.</li>
          </ol>
          <label className="block">
            <span className="text-sm font-semibold">SwaggPress API key</span>
            <input name="apiKey" type="password" autoComplete="off" placeholder="spk_…" className={`mt-1.5 ${inputClass}`} />
          </label>
          <FormError message={state.message} />
          <SubmitButton pending={pending} fullWidth={false}>
            Connect
          </SubmitButton>
        </form>
      )}
    </section>
  );
}
