"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renderJpeg } from "@/lib/proof-maker";
import { MAX_PRODUCT_PHOTOS } from "@/lib/store/rules";
import { moveProductPhoto, prepareProductPhotoUpload, removeProductPhoto, saveProductPhoto } from "./actions";

// Long side of each stored product picture.
const MAX_EDGE = 1600;

// Pictures of a store product (a sample canvas on a wall, the tee, the mug),
// shown to clients in the gallery shop. The first one is the cover. Resized
// in the browser, then uploaded straight to storage, one at a time.
export function ProductPhotos({ productId, photos }: { productId: string; photos: { key: string; url: string }[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const room = MAX_PRODUCT_PHOTOS - photos.length;

  function upload(files: File[]) {
    setError(null);
    const batch = files.slice(0, room);
    startTransition(async () => {
      try {
        for (const [i, file] of batch.entries()) {
          setProgress(`Uploading ${i + 1} of ${batch.length}…`);
          const bitmap = await createImageBitmap(file);
          const jpeg = await renderJpeg(bitmap, MAX_EDGE, 0.85);
          bitmap.close();
          const prepared = await prepareProductPhotoUpload(productId, jpeg.size);
          if ("error" in prepared) throw new Error(prepared.error);
          const response = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: jpeg });
          if (!response.ok) throw new Error("A picture didn't upload. Try again.");
          const saved = await saveProductPhoto(productId, prepared.version);
          if ("error" in saved) throw new Error(saved.error);
        }
        if (files.length > batch.length) setError(`Only ${MAX_PRODUCT_PHOTOS} pictures fit, so the rest were skipped.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "A picture didn't upload. Try again.");
      } finally {
        setProgress(null);
        router.refresh();
      }
    });
  }

  const busy = pending || progress !== null;
  const small = "grid size-7 place-items-center rounded-full bg-white/90 text-sm font-bold text-brand-deep shadow hover:bg-white disabled:opacity-40";

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Product pictures</h2>
        <span className="text-sm font-semibold text-muted">
          {photos.length} of {MAX_PRODUCT_PHOTOS}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Show clients what they&rsquo;re ordering: a sample on a wall, the tee, the mug. The first picture is the cover; use ← → to
        change the order.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {photos.map((photo, i) => (
          <div key={photo.key} className="group relative aspect-square overflow-hidden rounded-xl bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1 left-1 rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold tracking-wider text-on-accent uppercase">
                Cover
              </span>
            )}
            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button type="button" disabled={busy || i === 0} onClick={() => startTransition(() => moveProductPhoto(productId, photo.key, -1))} className={small} aria-label="Move earlier">
                ←
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => confirm("Remove this picture?") && startTransition(() => removeProductPhoto(productId, photo.key))}
                className={`${small} text-danger`}
                aria-label="Remove picture"
              >
                ×
              </button>
              <button
                type="button"
                disabled={busy || i === photos.length - 1}
                onClick={() => startTransition(() => moveProductPhoto(productId, photo.key, 1))}
                className={small}
                aria-label="Move later"
              >
                →
              </button>
            </div>
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-border text-center text-xs font-bold tracking-wider text-muted uppercase transition hover:border-lime hover:text-lime-ink disabled:opacity-60"
          >
            {progress ?? (
              <span>
                <span className="block text-2xl leading-none">+</span>
                Add {photos.length === 0 ? "pictures" : "more"}
              </span>
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <p className="mt-3 text-xs text-muted">JPG, PNG, or WebP. Large pictures are resized automatically.</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) upload(files);
        }}
      />
    </section>
  );
}
