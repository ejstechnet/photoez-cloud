"use client";

import { useState } from "react";
import { InquiryForm } from "../inquiry-form";

// The booking page's "by quote" box: services the studio prices by quote
// (weddings, events, product photography…), and a button that opens the
// quote request form right here. Requests land in the studio's Inquiries.
export function QuoteRequest({
  slug,
  studioName,
  sessions,
  initialType,
  startOpen,
}: {
  slug: string;
  studioName: string;
  sessions: { type: string; label: string; quote: boolean }[];
  initialType?: string;
  // Opened from a "Request a quote" link (?quote=…).
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const quoted = sessions.filter((s) => s.quote);
  if (quoted.length === 0) return null;

  return (
    <section id="quote" className="mt-10 scroll-mt-24 overflow-hidden rounded-3xl bg-brand-deep text-white shadow-xl shadow-brand-deep/25">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="text-sm font-bold tracking-wider text-lime uppercase">Priced by quote</p>
          <h2 className="mt-1 font-display text-3xl font-bold">Planning something bigger?</h2>
          <p className="mt-2 max-w-xl text-white/80">
            {quoted.map((s) => s.label).join(", ")} {quoted.length === 1 ? "is" : "are"} priced for each project. Tell{" "}
            {studioName} about yours and you&apos;ll get a personal quote.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {quoted.map((s) => (
              <li key={s.type} className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                {s.label}
              </li>
            ))}
          </ul>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0">
            Request a quote
          </button>
        )}
      </div>
      {open && (
        <div className="mx-4 mb-4 rounded-2xl bg-surface p-5 text-foreground sm:mx-8 sm:mb-8 sm:p-6">
          <InquiryForm slug={slug} studioName={studioName} sessions={sessions} initialType={initialType} quoteOnly />
        </div>
      )}
    </section>
  );
}
