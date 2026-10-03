"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkSong } from "@/lib/slideshow";
import { prepareSlideshowSong, removeSlideshowSong, saveSlideshowSong, setSlideshowEnabled } from "../slideshow-actions";

// The final photos' slideshow: on or off for this gallery, and its song.
// Clients play it from their delivered gallery with a ▶ Slideshow button.
export function SlideshowCard({
  galleryId,
  allowed,
  upgradeLabel,
  enabled,
  songName,
  songUrl,
  previewHref,
}: {
  galleryId: string;
  allowed: boolean;
  upgradeLabel: string;
  enabled: boolean;
  songName: string | null;
  songUrl: string | null;
  // The client view, opened straight into the slideshow.
  previewHref: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, start] = useTransition();

  if (!allowed) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-5">
        <p className="font-semibold">🎬 Slideshow with music</p>
        <p className="mt-1 text-sm text-muted">
          Let clients play their final photos as a full-screen slideshow, set to a song you choose. On the {upgradeLabel} plan and up.{" "}
          <Link href="/dashboard/billing" className="link">
            See plans
          </Link>
        </p>
      </div>
    );
  }

  async function upload(file: File) {
    setError(null);
    const checked = checkSong(file);
    if ("error" in checked) return setError(checked.error);
    const ready = await prepareSlideshowSong(galleryId, { type: file.type, name: file.name, size: file.size });
    if ("error" in ready) return setError(ready.error);
    // XMLHttpRequest, so a big song shows how far along it is.
    setProgress(0);
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", ready.uploadUrl);
      xhr.setRequestHeader("Content-Type", ready.contentType);
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    setProgress(null);
    if (!ok) return setError("The upload didn't go through. Check your connection and try again.");
    const saved = await saveSlideshowSong(galleryId, ready.version, ready.extension, file.name);
    if (saved.error) return setError(saved.error);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">🎬 Slideshow with music</p>
          <p className="text-sm text-muted">Clients play their final photos full-screen, set to your song.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={enabled}
            disabled={pending}
            onChange={(e) =>
              start(async () => {
                const result = await setSlideshowEnabled(galleryId, e.target.checked);
                if (result.error) setError(result.error);
                router.refresh();
              })
            }
            className="size-4 accent-lime-ink"
          />
          {enabled ? "On" : "Off"}
        </label>
      </div>

      {enabled && (
        <div className="mt-4 space-y-3">
          {songName && songUrl ? (
            <div className="rounded-xl bg-background p-3">
              <p className="truncate text-sm font-semibold">♪ {songName}</p>
              <audio controls preload="none" src={songUrl} className="mt-2 w-full" />
            </div>
          ) : (
            <p className="text-sm text-muted">No song yet: the slideshow plays without music.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,.mp3,.m4a,.aac,.wav"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) start(() => upload(file));
              }}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
              className="rounded-full border-2 border-border px-5 py-2 text-xs font-bold tracking-wider uppercase transition hover:border-lime-ink hover:bg-lime/15 disabled:opacity-60"
            >
              {progress !== null ? `Uploading… ${progress}%` : songName ? "Change song" : "Upload a song"}
            </button>
            {songName && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  window.confirm("Remove this song? The slideshow will play without music.") &&
                  start(async () => {
                    const result = await removeSlideshowSong(galleryId);
                    if (result.error) setError(result.error);
                    router.refresh();
                  })
                }
                className="rounded-full border-2 border-danger/40 px-5 py-2 text-xs font-bold tracking-wider text-danger uppercase hover:bg-danger/10"
              >
                Remove song
              </button>
            )}
            {previewHref && (
              <a href={previewHref} target="_blank" className="link text-sm">
                Preview slideshow
              </a>
            )}
          </div>
          <p className="text-xs text-muted">MP3, M4A, AAC, or WAV. Use music you have the rights to share with clients.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
