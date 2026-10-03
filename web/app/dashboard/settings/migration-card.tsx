"use client";

import { useState, useTransition } from "react";
import { CopyLink } from "@/components/copy-link";
import { createMigrationKey, revokeMigrationKey } from "./migration-actions";

export type KeyRow = { id: string; created: string; expires: string; lastUsed: string | null; expired: boolean };

// Settings > Move to WordPress: a one-time key that lets the free PhotoEZ
// Migration plugin copy this studio's clients, galleries and photos, session
// types, and contracts into a WordPress site. Nothing here changes.
export function MigrationCard({ siteUrl, keys }: { siteUrl: string; keys: KeyRow[] }) {
  const [newKey, setNewKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section id="migration" className="card scroll-mt-8 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold">Move to PhotoEZ for WordPress</h2>
      <p className="mt-1 text-sm text-muted">
        Switching to your own WordPress site? The free <strong>PhotoEZ Migration</strong> plugin copies your clients, galleries
        with all their photos and picks, session types and add-ons, and contract templates. Your PhotoEZ Cloud account isn&apos;t
        changed, so you can check everything before you switch.
      </p>

      <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm">
        <li>Install the PhotoEZ Migration plugin on your WordPress site, along with PhotoEZ.</li>
        <li>Make a migration key below and copy it. It works for 7 days and only reads your data.</li>
        <li>
          In WordPress, go to <strong>PhotoEZ → Migration</strong> (or <strong>Tools → PhotoEZ Migration</strong>), paste the key, and
          click <strong>Start import</strong>.
        </li>
      </ol>

      <div className="mt-4">
        <p className="mb-1.5 text-sm font-semibold">PhotoEZ Cloud address</p>
        <CopyLink url={siteUrl} label="PhotoEZ Cloud address" />
      </div>

      {newKey ? (
        <div className="mt-5 rounded-2xl bg-lime/15 p-4">
          <p className="text-sm font-semibold">Your new migration key. Copy it now: it won&apos;t be shown again.</p>
          <div className="mt-2">
            <CopyLink url={newKey} label="Migration key" />
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMessage(null);
              const r = await createMigrationKey();
              if (r.key) setNewKey(r.key);
              else setMessage(r.message ?? "The key couldn't be made.");
            })
          }
          className="btn-primary mt-5"
        >
          {pending ? "Making a key…" : "Make a migration key"}
        </button>
      )}
      {message && <p className="mt-3 text-sm font-medium text-danger">{message}</p>}

      {keys.length > 0 && (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span>
                Key made {k.created}
                <span className="block text-xs text-muted">
                  {k.expired ? `Expired ${k.expires}` : `Works until ${k.expires}`}
                  {k.lastUsed ? ` · last used ${k.lastUsed}` : " · not used yet"}
                </span>
              </span>
              {!k.expired && (
                <button
                  type="button"
                  onClick={() => window.confirm("Revoke this key? A transfer using it will stop.") && start(() => revokeMigrationKey(k.id))}
                  className="text-xs font-bold tracking-wider text-danger uppercase hover:underline"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
