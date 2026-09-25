"use client";

import { useRef, useState } from "react";
import { MAX_INSPO_PHOTOS } from "@/lib/booking/fields";
import { renderJpeg } from "@/lib/proof-maker";
import { prepareInspoUploads } from "./actions";

type Photo = { id: string; previewUrl: string; token: string | null; failed?: boolean };

// Inspiration photos on the booking form. Each photo is resized in the
// browser and uploaded right away; the form then sends a short token per
// photo ("batch:index") that the server checks before saving the booking.
export function InspoUploader({ slug, required, error }: { slug: string; required: boolean; error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const uploading = photos.some((p) => !p.token && !p.failed);

  async function add(files: File[]) {
    setMessage(null);
    const room = MAX_INSPO_PHOTOS - photos.length;
    if (files.length > room) setMessage(`You can add up to ${MAX_INSPO_PHOTOS} photos.`);
    const chosen = files.slice(0, room);
    if (chosen.length === 0) return;

    const pending: Photo[] = chosen.map((file) => ({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      token: null,
    }));
    setPhotos((current) => [...current, ...pending]);

    const prepared = await prepareInspoUploads(slug, chosen.length);
    if ("error" in prepared) {
      setMessage(prepared.error);
      setPhotos((current) => current.filter((p) => !pending.some((x) => x.id === p.id)));
      return;
    }
    await Promise.all(
      chosen.map(async (file, i) => {
        let token: string | null = null;
        try {
          const bitmap = await createImageBitmap(file);
          const jpeg = await renderJpeg(bitmap, 1600, 0.85);
          bitmap.close();
          const response = await fetch(prepared.urls[i], { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: jpeg });
          if (response.ok) token = `${prepared.batch}:${i}`;
        } catch {
          // Marked as failed below.
        }
        setPhotos((current) =>
          current.map((p) => (p.id === pending[i].id ? { ...p, token, failed: token === null } : p)),
        );
      }),
    );
  }

  return (
    <div>
      <span className="text-sm font-semibold">
        Inspiration photos {required ? <span className="text-danger">*</span> : <span className="font-normal text-muted">(optional)</span>}
      </span>
      <p className="text-xs text-muted">Looks, poses, or outfits you love. Up to {MAX_INSPO_PHOTOS} photos.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative size-20 overflow-hidden rounded-xl border-2 border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.previewUrl} alt="" className={`size-full object-cover ${photo.token ? "" : "opacity-50"}`} />
            {!photo.token && !photo.failed && (
              <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-brand-deep">Uploading…</span>
            )}
            {photo.failed && (
              <span className="absolute inset-0 grid place-items-center bg-danger/70 text-[10px] font-bold text-white">Failed</span>
            )}
            <button
              type="button"
              onClick={() => setPhotos((current) => current.filter((p) => p.id !== photo.id))}
              aria-label="Remove photo"
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-xs text-white"
            >
              ✕
            </button>
            {photo.token && <input type="hidden" name="inspo" value={photo.token} />}
          </div>
        ))}
        {photos.length < MAX_INSPO_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid size-20 place-items-center rounded-xl border-2 border-dashed border-border text-2xl text-muted transition hover:border-lime-ink hover:text-lime-ink"
            aria-label="Add inspiration photos"
          >
            +
          </button>
        )}
      </div>
      {uploading && <p className="mt-1.5 text-xs text-muted">Uploading your photos…</p>}
      {(message || error) && <p className="mt-1.5 text-xs font-medium text-danger">{message ?? error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          add([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
