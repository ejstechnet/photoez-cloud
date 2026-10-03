"use client";

import { useState } from "react";
import { inputClass } from "@/components/form";
import type { SourcePreview } from "@/lib/migration/importer";
import { STATUS_LABELS, type GalleryStatus } from "@/lib/gallery-status";
import { beginImport, connectSource, resetImport, stepImport, type ImportView } from "./import-actions";

const LABELS: [string, string][] = [
  ["clients", "Clients"],
  ["addons", "Add-ons"],
  ["sessionTypes", "Session types"],
  ["contracts", "Contract templates"],
  ["galleries", "Galleries"],
  ["photos", "Photos"],
];
const PHASES: Record<string, string> = {
  clients: "Bringing in clients…",
  addons: "Bringing in add-ons…",
  session_types: "Bringing in session types…",
  contracts: "Bringing in contract templates…",
  galleries: "Bringing in galleries and photos…",
  done: "Import finished!",
};

// Settings > Move from PhotoEZ for WordPress: paste the WordPress site's
// address and the migration key made there (PhotoEZ → Migration), then watch
// it come across. Leaving the page pauses it; Continue picks up again.
export function ImportCard({ initial }: { initial: ImportView | null }) {
  const [job, setJob] = useState(initial);
  const [address, setAddress] = useState("");
  const [key, setKey] = useState("");
  const [hideSessions, setHideSessions] = useState(true);
  const [running, setRunning] = useState(false);
  // After Connect: what the site has, and what's ticked.
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [parts, setParts] = useState({ clients: true, sessions: true, contracts: true });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(
    initial && !initial.finished ? { text: "Paused. Click Continue to pick up where it stopped.", error: false } : null,
  );

  async function loop() {
    setRunning(true);
    for (;;) {
      const r: { job?: ImportView; error?: string } = await stepImport().catch(() => ({ error: "The connection dropped." }));
      if (r.job) setJob(r.job);
      if (r.error) {
        setMessage({ text: `${r.error} The import is paused; click Continue to try again.`, error: true });
        break;
      }
      if (r.job?.finished) {
        setMessage({ text: "All done! Check your clients, galleries, Booking setup, and contracts.", error: false });
        break;
      }
    }
    setRunning(false);
  }

  // Step 1: connect and see what the WordPress site has (nothing is imported yet).
  async function connect() {
    if (!key.trim()) {
      setMessage({ text: "Paste your migration key first. It starts with pezm_.", error: true });
      return;
    }
    setRunning(true);
    setMessage({ text: `Connecting to ${address || "your site"}… Reading your galleries can take a moment.`, error: false });
    const r: { preview?: SourcePreview; error?: string } = await connectSource({ address, key }).catch(() => ({ error: "The connection dropped." }));
    setRunning(false);
    if (!r.preview) {
      setMessage({ text: r.error ?? "Couldn't connect to your WordPress site.", error: true });
      return;
    }
    setPreview(r.preview);
    setPicked(new Set(r.preview.galleries.map((g) => g.id)));
    setMessage(null);
  }

  // Step 2: bring over only what's ticked.
  async function start() {
    if (!preview) return;
    const galleries = preview.galleries.filter((g) => picked.has(g.id));
    if (!parts.clients && !parts.sessions && !parts.contracts && galleries.length === 0) {
      setMessage({ text: "Tick at least one thing to bring over.", error: true });
      return;
    }
    setRunning(true);
    setMessage({ text: "Starting…", error: false });
    const r: { job?: ImportView; error?: string } = await beginImport({
      address,
      key,
      hideSessions,
      include: {
        ...parts,
        galleryIds: galleries.map((g) => g.id),
        clientIds: [...new Set(galleries.map((g) => g.clientId).filter((id): id is string => Boolean(id)))],
      },
      galleries: preview.galleries.map((g) => ({ id: g.id, photos: g.photos })),
    }).catch(() => ({ error: "The connection dropped." }));
    if (!r.job) {
      setRunning(false);
      setMessage({ text: r.error ?? "The import couldn't start.", error: true });
      return;
    }
    setJob(r.job);
    setMessage(null);
    await loop();
  }

  const toggle = (id: string) =>
    setPicked((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pickedPhotos = preview ? preview.galleries.filter((g) => picked.has(g.id)).reduce((sum, g) => sum + g.photos, 0) : 0;

  const totals = job?.totals ?? {};
  const done = job?.done ?? {};
  const total = (totals.clients ?? 0) + (totals.photos ?? 0) + 5;
  const have = (done.clients ?? 0) + (done.photos ?? 0) + ["addons", "session_types", "contracts", "galleries", "done"].indexOf(job?.phase ?? "") + 1;
  const pct = job?.finished ? 100 : Math.max(3, Math.min(99, Math.round((have / total) * 100)));

  return (
    <section id="import" className="card scroll-mt-8 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold">Move from PhotoEZ for WordPress</h2>
      <p className="mt-1 text-sm text-muted">
        Coming from PhotoEZ on your own WordPress site? Bring your clients, galleries with every photo and client pick, session
        types and add-ons, and contract templates here. Anything you already have with the same email or name is kept, not
        duplicated, and nothing on your WordPress site changes.
      </p>

      {!job ? (
        <div className="mt-5 space-y-4">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>On your WordPress site, install the free PhotoEZ Migration plugin (version 1.1 or newer).</li>
            <li>
              In WordPress, go to <strong>PhotoEZ → Migration</strong>, and under <strong>Move to PhotoEZ Cloud</strong> click{" "}
              <strong>Make a migration key</strong>.
            </li>
            <li>Paste your site&apos;s address and the key here, click Connect, choose what to bring over, and click Start import. Keep this page open while it runs.</li>
          </ol>
          <label className="block">
            <span className="text-sm font-semibold">Your WordPress site</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="https://yourstudio.com" className={`mt-1.5 ${inputClass}`} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Migration key</span>
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="pezm_…"
              className={`mt-1.5 ${inputClass}`}
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={hideSessions} onChange={(e) => setHideSessions(e.target.checked)} className="mt-0.5 size-4 accent-lime-ink" />
            <span>
              Hide imported session types until I review them
              <span className="block text-muted">They won&apos;t show on your booking page until you turn them on in Booking setup.</span>
            </span>
          </label>
          {!preview && (
            <>
              {message && <Message text={message.text} error={message.error} />}
              <button type="button" onClick={connect} disabled={running} className="btn-primary">
                {running ? "Connecting…" : "Connect"}
              </button>
              <p className="text-xs text-muted">Connecting only looks. You&apos;ll choose what to bring over next.</p>
            </>
          )}

          {preview && (
            <div className="space-y-4 rounded-2xl border-2 border-border p-4 sm:p-5">
              <p className="font-semibold">
                Connected to {preview.studioName ?? "your site"}. Choose what to bring over:
              </p>
              <div className="space-y-2 text-sm">
                {(
                  [
                    ["clients", "Clients", `${preview.counts.clients} clients. If you leave this off, clients of the galleries you choose still come, so each gallery keeps its client.`],
                    ["sessions", "Session types & add-ons", `${preview.counts.sessionTypes} session types, ${preview.counts.addons} add-ons`],
                    ["contracts", "Contract templates", `${preview.counts.contracts} templates`],
                  ] as const
                ).map(([k, label, note]) => (
                  <label key={k} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={parts[k]}
                      onChange={(e) => setParts({ ...parts, [k]: e.target.checked })}
                      className="mt-0.5 size-4 accent-lime-ink"
                    />
                    <span>
                      <span className="font-semibold">{label}</span>
                      <span className="block text-muted">{note}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    Galleries: {picked.size} of {preview.galleries.length} chosen · {pickedPhotos} photos
                  </p>
                  <span className="flex gap-3 text-xs font-bold tracking-wider uppercase">
                    <button type="button" onClick={() => setPicked(new Set(preview.galleries.map((g) => g.id)))} className="text-lime-ink hover:underline">
                      Select all
                    </button>
                    <button type="button" onClick={() => setPicked(new Set())} className="text-muted hover:underline">
                      Select none
                    </button>
                  </span>
                </div>
                {preview.galleries.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No galleries on this site.</p>
                ) : (
                  <ul className="mt-2 max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border text-sm">
                    {preview.galleries.map((g) => (
                      <li key={g.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-background">
                          <input type="checkbox" checked={picked.has(g.id)} onChange={() => toggle(g.id)} className="size-4 shrink-0 accent-lime-ink" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{g.title}</span>
                            <span className="block truncate text-xs text-muted">
                              {g.clientName ?? "No client"} · {STATUS_LABELS[g.status as GalleryStatus] ?? g.status}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-muted">
                            {g.photos} {g.photos === 1 ? "photo" : "photos"}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {message && <Message text={message.text} error={message.error} />}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={start} disabled={running} className="btn-primary">
                  {running ? "Starting…" : "Start import"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setMessage(null);
                  }}
                  disabled={running}
                  className="text-sm font-semibold text-muted underline hover:text-foreground"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <p className="font-semibold">
            {job.finished ? "Imported" : "Importing"} {job.studioName ?? "your studio"}
          </p>
          <div className="h-4 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full bg-lime transition-all duration-500 ${running ? "animate-pulse" : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm font-semibold">
            {PHASES[job.phase] ?? ""} <span className="font-normal text-muted">{pct}%</span>
          </p>
          <dl className="grid max-w-md grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {LABELS.map(([k, label]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd>
                  <strong>{done[k] ?? 0}</strong>
                  {totals[k] !== undefined && ` of ${totals[k]}`}
                </dd>
              </div>
            ))}
          </dl>
          {message && <Message text={message.text} error={message.error} />}
          {job.errors.length > 0 && (
            <details className="text-sm" open={job.finished}>
              <summary className="cursor-pointer font-semibold">Not imported ({job.errors.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {job.errors.map((e, i) => (
                  <li key={i}>
                    <strong>{e.what}:</strong> {e.why}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!running && (
            <div className="flex flex-wrap gap-3">
              {!job.finished && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    void loop();
                  }}
                  className="btn-primary"
                >
                  Continue
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("Start a new import? What's already imported stays, and won't be imported twice.")) return;
                  await resetImport();
                  setJob(null);
                  setMessage(null);
                }}
                className="btn-secondary"
              >
                Start a new import
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Message({ text, error }: { text: string; error: boolean }) {
  return (
    <p role={error ? "alert" : undefined} className={`rounded-xl px-3.5 py-2.5 text-sm font-medium ${error ? "bg-danger/10 text-danger" : "bg-lime/15"}`}>
      {text}
    </p>
  );
}
