"use client";

import { useState, useTransition } from "react";
import { setHideBranding } from "./actions";

// Studio plan: a switch for the "Powered by PhotoEZ Cloud" line at the
// bottom of the studio's pages.
export function BrandingToggle({ hidden, allowed }: { hidden: boolean; allowed: boolean }) {
  const [on, setOn] = useState(hidden);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <label className={`flex items-center gap-3 text-sm font-semibold ${allowed ? "" : "opacity-60"}`}>
        <input
          type="checkbox"
          className="size-5 accent-[var(--lime)]"
          checked={on}
          disabled={!allowed || pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            setError(null);
            start(async () => {
              const result = await setHideBranding(next);
              if ("error" in result) {
                setOn(!next);
                setError(result.error);
              }
            });
          }}
        />
        Hide &ldquo;Powered by PhotoEZ Cloud&rdquo; on my studio pages
      </label>
      {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
