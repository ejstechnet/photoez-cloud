"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagesIcon } from "@/components/icons";
import { renderJpeg } from "@/lib/proof-maker";
import { prepareSessionImageUpload, removeSessionImage, saveSessionImage } from "../../actions";

// Long side of the stored photo: sharp on the booking page, still quick to load.
const MAX_EDGE = 1600;

// The photo shown above this session on the booking page. Saves right away,
// separately from the rest of the session form.
export function SessionPhoto({ sessionTypeId, currentUrl }: { sessionTypeId: string; currentUrl: string | null }) {
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
        // Resize in the browser, so a 20 MB camera file becomes a light JPEG.
        const bitmap = await createImageBitmap(file);
        const jpeg = await renderJpeg(bitmap, MAX_EDGE, 0.85);
        bitmap.close();
        const prepared = await prepareSessionImageUpload(sessionTypeId, jpeg.size);
        if ("error" in prepared) throw new Error(prepared.error);
        const response = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: jpeg });
        if (!response.ok) throw new Error("The photo didn't upload. Try again.");
        const saved = await saveSessionImage(sessionTypeId, prepared.version);
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
      <span className="text-sm font-semibold">Session photo</span>
      <div className="mt-1.5 grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-center">
        <div className="grid aspect-[2/3] w-40 place-items-center overflow-hidden rounded-2xl border-2 border-border bg-background">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Session photo" className="size-full object-cover" />
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
                  confirm("Remove this session's photo?") &&
                  startTransition(async () => {
                    await removeSessionImage(sessionTypeId);
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
          <p className="text-xs text-muted">Shown above this session on your booking page as a 2:3 portrait, so a vertical photo fits best.</p>
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
