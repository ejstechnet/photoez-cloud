"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagesIcon } from "@/components/icons";
import { renderJpeg } from "@/lib/proof-maker";

// Long side of the stored photo: sharp on public pages, still quick to load.
const DEFAULT_MAX_EDGE = 1600;

type Saved = { ok: true } | { error: string };

// A photo that saves right away (separately from any form around it). The
// browser resizes it to a JPEG and uploads it straight to storage with a
// one-time link from `prepare`; `save` then checks it arrived and swaps it in.
// Used for session photos and add-on photos.
export function PhotoUpload({
  label,
  hint,
  aspect,
  maxEdge = DEFAULT_MAX_EDGE,
  currentUrl,
  prepare,
  save,
  remove,
}: {
  label: string;
  hint: string;
  aspect: "portrait" | "square";
  // Long side in pixels; larger for full-width images like a gallery header.
  maxEdge?: number;
  currentUrl: string | null;
  prepare: (size: number) => Promise<{ version: string; url: string } | { error: string }>;
  save: (version: string) => Promise<Saved>;
  remove: () => Promise<void>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = preview ?? currentUrl;

  function upload(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    startTransition(async () => {
      try {
        const bitmap = await createImageBitmap(file);
        const jpeg = await renderJpeg(bitmap, maxEdge, 0.85);
        bitmap.close();
        const prepared = await prepare(jpeg.size);
        if ("error" in prepared) throw new Error(prepared.error);
        const response = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: jpeg });
        if (!response.ok) throw new Error("The photo didn't upload. Try again.");
        const saved = await save(prepared.version);
        if ("error" in saved) throw new Error(saved.error);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "The photo didn't upload. Try again.");
        setPreview(null);
      }
    });
  }

  return (
    <div>
      <span className="text-sm font-semibold">{label}</span>
      <div className="mt-1.5 grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-center">
        <div
          className={`grid place-items-center overflow-hidden rounded-2xl border-2 border-border bg-background ${
            aspect === "portrait" ? "aspect-[2/3] w-40" : "aspect-square w-40"
          }`}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={label} className="size-full object-cover" />
          ) : (
            <ImagesIcon size={28} className="text-muted" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="btn-secondary">
              {pending ? "Uploading…" : shown ? "Replace photo" : "Add a photo"}
            </button>
            {currentUrl && !pending && (
              <button
                type="button"
                onClick={() =>
                  confirm("Remove this photo?") &&
                  startTransition(async () => {
                    await remove();
                    setPreview(null);
                    router.refresh();
                  })
                }
                className="text-xs font-bold tracking-wider text-danger uppercase hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-muted">{hint}</p>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
