"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { ImagesIcon } from "@/components/icons";
import { renderJpeg } from "@/lib/proof-maker";

// The gallery's header banner, cropped like PhotoEZ for WordPress: a fixed
// wide banner shape (2400 × 1050) the photographer drags and zooms within.
// The original is kept (resized) so "Adjust crop" can re-frame it later.
const BANNER_WIDTH = 2400;
const BANNER_HEIGHT = 1050;
const SOURCE_MAX_EDGE = 3200;

type Prepared = { source: string; crop: string; sourceUrl: string | null; bannerUrl: string } | { error: string };

export function HeaderPhoto({
  currentUrl,
  sourceUrl,
  prepare,
  save,
  remove,
}: {
  currentUrl: string | null;
  // The kept original, when this banner can be re-cropped.
  sourceUrl: string | null;
  prepare: (sizes: { source: number | null; banner: number }) => Promise<Prepared>;
  save: (source: string, crop: string) => Promise<{ ok: true } | { error: string }>;
  remove: () => Promise<void>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The photo open in the crop pop-up, and whether it's a new original to upload.
  const [editing, setEditing] = useState<{ blob: Blob; url: string; isNew: boolean } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  function open(blob: Blob, isNew: boolean) {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setEditing({ blob, url: URL.createObjectURL(blob), isNew });
  }

  function close() {
    if (editing) URL.revokeObjectURL(editing.url);
    setEditing(null);
  }

  async function chooseFile(file: File) {
    setError(null);
    try {
      // Keep a lighter copy of the original: plenty for any future crop.
      const bitmap = await createImageBitmap(file);
      const source = await renderJpeg(bitmap, SOURCE_MAX_EDGE, 0.9);
      bitmap.close();
      open(source, true);
    } catch {
      setError("That photo couldn't be opened. Try a JPG or PNG.");
    }
  }

  async function adjust() {
    if (!sourceUrl) return;
    setError(null);
    try {
      // fetch → blob keeps the canvas untainted, so the crop can be exported.
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error();
      open(await response.blob(), false);
    } catch {
      setError("The original photo couldn't be loaded. Choose it again to crop it.");
    }
  }

  function saveCrop() {
    if (!editing || !area) return;
    const current = editing;
    startTransition(async () => {
      try {
        const bitmap = await createImageBitmap(current.blob);
        const canvas = document.createElement("canvas");
        canvas.width = BANNER_WIDTH;
        canvas.height = BANNER_HEIGHT;
        const context = canvas.getContext("2d")!;
        context.imageSmoothingQuality = "high";
        context.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, BANNER_WIDTH, BANNER_HEIGHT);
        bitmap.close();
        const banner = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error())), "image/jpeg", 0.88),
        );

        const prepared = await prepare({ source: current.isNew ? current.blob.size : null, banner: banner.size });
        if ("error" in prepared) throw new Error(prepared.error);
        const put = (url: string, body: Blob) =>
          fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body }).then((r) => {
            if (!r.ok) throw new Error("The photo didn't upload. Try again.");
          });
        await Promise.all([
          put(prepared.bannerUrl, banner),
          prepared.sourceUrl ? put(prepared.sourceUrl, current.blob) : Promise.resolve(),
        ]);
        const saved = await save(prepared.source, prepared.crop);
        if ("error" in saved) throw new Error(saved.error);
        close();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "The header couldn't be saved. Try again.");
      }
    });
  }

  return (
    <div>
      <span className="text-sm font-semibold">Header photo</span>
      <div className="mt-1.5 grid aspect-[16/7] w-full place-items-center overflow-hidden rounded-2xl border-2 border-border bg-background">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Gallery header" className="size-full object-cover" />
        ) : (
          <ImagesIcon size={28} className="text-muted" />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="btn-secondary">
          {currentUrl ? "Choose a different photo" : "Add a header photo"}
        </button>
        {sourceUrl && (
          <button type="button" onClick={adjust} disabled={pending} className="btn-secondary">
            Adjust crop
          </button>
        )}
        {currentUrl && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirm("Remove the header photo?") &&
              startTransition(async () => {
                await remove();
                router.refresh();
              })
            }
            className="text-xs font-bold tracking-wider text-danger uppercase hover:underline"
          >
            Remove
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        A large banner across the top of your client&apos;s gallery. You&apos;ll frame it in the banner shape after
        choosing a photo.
      </p>
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) chooseFile(file);
          e.target.value = "";
        }}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Crop header photo">
          <div className="w-full max-w-4xl rounded-3xl bg-surface p-5 shadow-2xl sm:p-6">
            <h2 className="font-display text-2xl font-bold">Crop header photo</h2>
            <p className="mt-1 text-sm text-muted">Drag to position the photo and zoom to frame it. The box is the banner.</p>
            <div className="relative mt-4 h-[55vh] overflow-hidden rounded-2xl bg-black">
              <Cropper
                image={editing.url}
                crop={crop}
                zoom={zoom}
                aspect={BANNER_WIDTH / BANNER_HEIGHT}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="horizontal-cover"
              />
            </div>
            <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-lime-ink"
              />
            </label>
            {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={close} disabled={pending} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={saveCrop} disabled={pending || !area} className="btn-primary">
                {pending ? "Saving…" : "Save crop"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
