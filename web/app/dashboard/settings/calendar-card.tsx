"use client";

import { useState, useTransition } from "react";
import { makeCalendarLink, resetCalendarLink } from "./calendar-actions";

// Settings > Calendar: a private link that puts the studio's bookings in
// Google, Apple, or Outlook Calendar (app/calendar/[token]/route.ts).
export function CalendarCard({ link }: { link: string | null }) {
  const [url, setUrl] = useState(link);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const make = () =>
    start(async () => {
      setUrl(await makeCalendarLink());
    });
  const reset = () => {
    if (!window.confirm("Make a new link? The old one stops working, so you'll need to add the new one to your calendar again.")) return;
    start(async () => {
      setUrl(await resetCalendarLink());
      setCopied(false);
    });
  };
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section id="calendar" className="card scroll-mt-8 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold">Calendar</h2>
      <p className="mt-1 text-sm text-muted">
        Put your bookings in Google Calendar, Apple Calendar, or Outlook. New, moved, and cancelled bookings update on their own.
      </p>
      {url ? (
        <>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={url}
              aria-label="Your private calendar link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <button type="button" onClick={copy} className="btn-primary shrink-0">
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Keep this link private: anyone with it can see your bookings.</p>
          <details className="mt-5 text-sm">
            <summary className="cursor-pointer font-semibold">How to add it to your calendar</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
              <li>
                <strong className="text-foreground">Google Calendar</strong> (on a computer): beside &ldquo;Other calendars&rdquo; click{" "}
                <strong>+</strong>, choose <strong>From URL</strong>, paste the link, and click <strong>Add calendar</strong>. Google
                checks for changes every few hours.
              </li>
              <li>
                <strong className="text-foreground">Apple Calendar</strong>: <a className="link" href={url.replace(/^https?:/, "webcal:")}>open the link here</a>, or
                on a Mac choose <strong>File → New Calendar Subscription</strong> and paste it.
              </li>
              <li>
                <strong className="text-foreground">Outlook</strong>: <strong>Add calendar → Subscribe from web</strong>, then paste the
                link.
              </li>
            </ul>
          </details>
          <button type="button" onClick={reset} disabled={pending} className="mt-5 text-sm font-semibold text-muted underline hover:text-foreground">
            Reset link
          </button>
        </>
      ) : (
        <button type="button" onClick={make} disabled={pending} className="btn-primary mt-5">
          {pending ? "Making your link…" : "Get my calendar link"}
        </button>
      )}
    </section>
  );
}
