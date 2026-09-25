"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export type PickerSession = {
  id: string;
  name: string;
  summary: string | null;
  facts: string;
  price: string;
  // The regular price, struck through, when the session is on sale.
  wasPrice: string | null;
  photoUrl: string | null;
  // Sanitized on the server (richTextHtml), safe to render.
  descriptionHtml: string;
  href: string;
};

// Session cards like PhotoEZ Booking for WordPress: tidy, even cards with the
// short description only; the full description opens in a pop-up, where the
// client picks the session.
export function SessionPicker({ sessions }: { sessions: PickerSession[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<PickerSession | null>(null);

  function show(session: PickerSession) {
    setOpen(session);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => show(s)}
              className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-border bg-surface text-left transition hover:-translate-y-1 hover:border-lime hover:shadow-xl"
            >
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt="" className="aspect-[2/3] w-full object-cover" />
              ) : null}
              <span className="flex flex-1 flex-col p-5">
                <span className="font-display text-xl font-bold">{s.name}</span>
                {s.summary && <span className="mt-1.5 line-clamp-2 text-sm text-muted">{s.summary}</span>}
                <span className="mt-auto pt-4">
                  <span className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-lime-ink">{s.price}</span>
                    {s.wasPrice && (
                      <>
                        <s className="text-base text-muted">{s.wasPrice}</s>
                        <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold tracking-wider text-brand-deep uppercase">
                          Sale
                        </span>
                      </>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{s.facts}</span>
                  <span className="btn-primary mt-4 w-full">Select Session</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        // Clicking the dim backdrop (the dialog element itself) closes it.
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        className="m-auto max-h-[90vh] w-[92vw] max-w-lg overflow-y-auto rounded-3xl bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/60"
      >
        {open && (
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-3xl font-bold">{open.name}</h2>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-full text-2xl leading-none text-muted transition hover:bg-border hover:text-foreground"
              >
                ×
              </button>
            </div>
            {open.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.photoUrl} alt="" className="mx-auto mt-4 aspect-[2/3] w-full max-w-xs rounded-2xl object-cover" />
            )}
            {open.descriptionHtml ? (
              <div className="rich-text mt-5 text-muted" dangerouslySetInnerHTML={{ __html: open.descriptionHtml }} />
            ) : (
              open.summary && <p className="mt-5 text-muted">{open.summary}</p>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <div>
                <p className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-lime-ink">{open.price}</span>
                  {open.wasPrice && <s className="text-base text-muted">{open.wasPrice}</s>}
                </p>
                <p className="text-xs text-muted">{open.facts}</p>
              </div>
              <Link href={open.href} scroll={false} onClick={() => dialogRef.current?.close()} className="btn-primary">
                Select This Session
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
