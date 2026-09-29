"use client";

import Link from "next/link";
import { useState } from "react";

// "Show in galleries for": every gallery, or only galleries for some session
// types (e.g. senior items only in Senior Session galleries). Sends
// appliesTo=all|some and sessionTypeIds.
export function SessionPicker({ sessions, selected }: { sessions: { id: string; name: string }[]; selected: string[] }) {
  const [some, setSome] = useState(selected.length > 0);
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Show in galleries for</legend>
      {sessions.length === 0 ? (
        <p className="mt-1 text-sm text-muted">
          Every gallery. To limit it to certain kinds of shoots, add session types on{" "}
          <Link href="/dashboard/bookings/setup" className="link">
            Bookings
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="appliesTo" value="all" checked={!some} onChange={() => setSome(false)} className="accent-lime-ink" />
              Every gallery
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="appliesTo" value="some" checked={some} onChange={() => setSome(true)} className="accent-lime-ink" />
              Only galleries for some sessions
            </label>
          </div>
          {some && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {sessions.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 rounded-xl border-2 border-border px-3 py-2 text-sm">
                    <input type="checkbox" name="sessionTypeIds" value={s.id} defaultChecked={selected.includes(s.id)} className="size-4 accent-lime-ink" />
                    {s.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-xs text-muted">
            A gallery&rsquo;s session type comes from its booking, or you can set it in the gallery&rsquo;s settings.
          </p>
        </>
      )}
    </fieldset>
  );
}
