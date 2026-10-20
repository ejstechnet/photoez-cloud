"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_UPLOAD, PHOTO_TYPES, UPLOAD_CHUNK, type PhotoKind } from "@/lib/photo-limits";
import { loadWatermark, makeProof, renderJpeg, type WatermarkSettings } from "@/lib/proof-maker";
import { ImagesIcon } from "@/components/icons";
import { confirmUpload, prepareUploads } from "../actions";

type Status = "waiting" | "uploading" | "done" | "error";
type Item = { key: string; name: string; status: Status; progress: number; error?: string };
// One photo's signed upload links, from prepareUploads.
type PreparedUpload = Extract<Awaited<ReturnType<typeof prepareUploads>>, { uploads: unknown }>["uploads"][number];
type QueuedPhoto = { file: File; key: string; upload: PreparedUpload };

const PARALLEL_UPLOADS = 3;

// PUT a file to a signed upload URL, reporting progress (0–1).
function put(url: string, body: Blob, contentType: string, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total);
    request.onload = () => (request.status < 300 ? resolve() : reject(new Error(`upload failed (${request.status})`)));
    request.onerror = () => reject(new Error("network error"));
    request.send(body);
  });
}

// `kind` decides where the photos go: watermarked proofs for the client to
// choose from, or clean finals for delivery.
export function Uploader({
  galleryId,
  kind,
  watermark,
}: {
  galleryId: string;
  kind: PhotoKind;
  watermark: WatermarkSettings | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = items.some((item) => item.status === "waiting" || item.status === "uploading");

  const update = (key: string, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function upload(fileList: FileList | File[]) {
    setNotice(null);
    const all = Array.from(fileList);
    if (all.length === 0) {
      // Dragged from another app (Lightroom, Photos, a zip) that hands over no actual files.
      setNotice("Those photos couldn't be read. Use “Choose photos” and pick them from a folder instead.");
      return;
    }
    const files = all.filter(
      (file) => (PHOTO_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_PHOTO_BYTES,
    );
    const skipped = all.length - files.length;
    if (skipped > 0) {
      setNotice(`${skipped} file${skipped === 1 ? " was" : "s were"} skipped. Use JPEG, PNG, or WebP photos up to 50 MB.`);
    }
    if (files.length === 0) return;
    if (files.length > MAX_PHOTOS_PER_UPLOAD) {
      setNotice(`Upload up to ${MAX_PHOTOS_PER_UPLOAD.toLocaleString()} photos at a time.`);
      return;
    }

    const batch = files.map((file, i) => ({ file, key: `${Date.now()}-${i}` }));
    setItems((current) => [
      ...current.filter((item) => item.status !== "done"),
      ...batch.map(({ file, key }) => ({ key, name: file.name, status: "waiting" as const, progress: 0 })),
    ]);

    let stamp: Awaited<ReturnType<typeof loadWatermark>> = null;
    try {
      // Finals are delivered clean, so only proofs get the watermark.
      stamp = kind === "proof" ? await loadWatermark(watermark) : null;
    } catch {
      setNotice("Your watermark couldn't be loaded, so these proofs were saved without it. Use “Update proofs” later.");
    }

    // Upload links are asked for a few photos at a time, just before they're
    // used, so even a slow 1,000-photo upload never hits an expired link.
    for (let start = 0; start < batch.length; start += UPLOAD_CHUNK) {
      const chunk = batch.slice(start, start + UPLOAD_CHUNK);
      let prepared: Awaited<ReturnType<typeof prepareUploads>>;
      try {
        prepared = await prepareUploads(
          galleryId,
          chunk.map(({ file }) => ({ name: file.name, type: file.type, size: file.size })),
        );
      } catch {
        prepared = { error: "Couldn't reach PhotoEZ Cloud. Check your connection and try these again." };
      }
      if ("error" in prepared) {
        // Usually "storage is full": the rest won't fit either, so stop here.
        const { error } = prepared;
        batch.slice(start).forEach(({ key }) => update(key, { status: "error", error }));
        break;
      }
      const uploads = prepared.uploads;
      await uploadChunk(chunk.map((entry, i) => ({ ...entry, upload: uploads[i] })));
    }
    router.refresh();

    async function uploadChunk(queue: QueuedPhoto[]) {
      await Promise.all(Array.from({ length: PARALLEL_UPLOADS }, () => worker(queue)));
    }

    async function worker(queue: QueuedPhoto[]) {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const { file, key, upload } = next;
        update(key, { status: "uploading" });
        try {
          // createImageBitmap applies the camera's rotation, so every version comes out upright.
          const bitmap = await createImageBitmap(file);
          const preview = await renderJpeg(bitmap, 2048, 0.85);
          const thumb = await renderJpeg(bitmap, 900, 0.8);
          const proof = stamp ? await makeProof(bitmap, stamp) : null;
          const { width, height } = bitmap;
          bitmap.close();

          await put(upload.urls.thumb, thumb, "image/jpeg");
          await put(upload.urls.preview, preview, "image/jpeg");
          if (proof) await put(upload.urls.proof, proof, "image/jpeg");
          await put(upload.urls.original, file, file.type, (fraction) => update(key, { progress: fraction }));

          const saved = await confirmUpload(galleryId, {
            photoId: upload.photoId,
            originalName: file.name,
            contentType: file.type as (typeof PHOTO_TYPES)[number],
            width,
            height,
            kind,
            hasProof: proof !== null,
          });
          if ("error" in saved) throw new Error(saved.error);
          update(key, { status: "done", progress: 1 });
        } catch (error) {
          update(key, { status: "error", error: error instanceof Error ? error.message : "Upload failed." });
        }
      }
    }
  }

  const doneCount = items.filter((item) => item.status === "done").length;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) upload(event.dataTransfer.files);
        }}
        className={`flex flex-col items-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-lime bg-lime/10" : "border-border bg-surface"
        }`}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-violet text-brand-deep">
          <ImagesIcon size={26} />
        </span>
        <p className="mt-4 font-display text-xl font-bold">
          {kind === "proof" ? "Drop proofs here" : "Drop final photos here"}
        </p>
        <p className="mt-1 text-sm text-muted">JPEG, PNG, or WebP · up to 50 MB each</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-primary mt-5"
        >
          {busy ? "Uploading…" : "Choose photos"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) upload(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {notice && (
        <p role="status" className="mt-3 rounded-xl bg-sun/20 px-4 py-2.5 text-sm font-medium">
          {notice}
        </p>
      )}

      {items.length > 0 && (
        <div className="card mt-4 p-4">
          <p className="text-sm font-semibold">
            {doneCount} of {items.length} uploaded
          </p>
          <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.key} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{item.name}</span>
                  <span
                    className={`shrink-0 text-xs font-bold tracking-wider uppercase ${
                      item.status === "done" ? "text-lime-ink" : item.status === "error" ? "text-danger" : "text-muted"
                    }`}
                  >
                    {item.status === "uploading" ? `${Math.round(item.progress * 100)}%` : item.status}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-all ${item.status === "error" ? "bg-danger" : "bg-lime"}`}
                    style={{ width: `${item.status === "error" ? 100 : Math.round(item.progress * 100)}%` }}
                  />
                </div>
                {item.error && <p className="mt-1 text-xs text-danger">{item.error}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
