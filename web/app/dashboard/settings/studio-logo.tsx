"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagesIcon } from "@/components/icons";
import { prepareLogoUpload, removeStudioLogo, saveLogoBackground, saveStudioLogo } from "./actions";

// Colors for the top menu bar on the studio's public pages, which the logo
// sits on. "transparent" (PhotoEZ navy) is for logos made for dark backgrounds.
const SWATCHES = [
  { value: "#ffffff", label: "White" },
  { value: "#f4f4f8", label: "Light gray" },
  { value: "#1a3a6b", label: "Navy" },
  { value: "#111111", label: "Black" },
  { value: "transparent", label: "PhotoEZ navy" },
];
const HEADER_NAVY = "#0f2548";
const cardColor = (bg: string) => (bg === "transparent" ? HEADER_NAVY : bg);

// Studio logo for the public pages, and the color of the menu bar it sits on.
// Both save right away, separately from the rest of the studio profile.
export function StudioLogo({ currentUrl, background }: { currentUrl: string | null; background: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bg, setBg] = useState(background);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shown = preview ?? currentUrl;

  // Update the preview at once; save shortly after the last change, so
  // dragging through the color picker doesn't send a save for every shade.
  function chooseBackground(value: string) {
    setBg(value);
    setError(null);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const saved = await saveLogoBackground(value);
      if ("error" in saved) setError(saved.error);
    }, 400);
  }

  function upload(file: File) {
    setError(null);
    setPreview(URL.createObjectURL(file));
    startTransition(async () => {
      const prepared = await prepareLogoUpload({ type: file.type, size: file.size });
      if ("error" in prepared) {
        setError(prepared.error);
        setPreview(null);
        return;
      }
      const response = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const saved = response.ok
        ? await saveStudioLogo(prepared.version, prepared.extension)
        : { error: "The logo didn't upload. Try again." };
      if ("error" in saved) {
        setError(saved.error);
        setPreview(null);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <span className="text-sm font-semibold">Studio logo</span>
      <div className="mt-1.5 flex items-center gap-4">
        <div
          // A preview of the menu bar: the logo on the chosen color, as clients see it.
          className="flex h-20 w-44 shrink-0 items-center overflow-hidden rounded-2xl border-2 border-border px-4 transition-colors sm:w-56"
          style={{ backgroundColor: cardColor(bg) }}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="Studio logo" className="h-14 w-auto max-w-full object-contain" />
          ) : (
            <ImagesIcon size={28} className="text-muted" />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="btn-secondary">
              {pending ? "Uploading…" : shown ? "Replace logo" : "Upload logo"}
            </button>
            {currentUrl && !pending && (
              <button
                type="button"
                onClick={() =>
                  confirm("Remove your logo from the studio page?") &&
                  startTransition(async () => {
                    await removeStudioLogo();
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
          <p className="text-xs text-muted">PNG, JPG, or WebP up to 5 MB. A transparent PNG looks best.</p>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      </div>

      <div className="mt-4">
        <span className="text-sm font-semibold">Menu bar color</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              onClick={() => chooseBackground(swatch.value)}
              aria-pressed={bg === swatch.value}
              className={`flex items-center gap-2 rounded-full border-2 py-1 pr-3 pl-1 text-sm font-semibold transition ${
                bg === swatch.value ? "border-lime bg-lime/10" : "border-border hover:border-muted"
              }`}
            >
              <span
                className="size-6 rounded-full border border-black/10"
                style={
                  swatch.value === "transparent"
                    ? { background: "repeating-conic-gradient(#d4d4d8 0 25%, #ffffff 0 50%) 0 0 / 10px 10px" }
                    : { backgroundColor: swatch.value }
                }
              />
              {swatch.label}
            </button>
          ))}
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-full border-2 py-1 pr-3 pl-1 text-sm font-semibold transition ${
              !SWATCHES.some((swatch) => swatch.value === bg) ? "border-lime bg-lime/10" : "border-border hover:border-muted"
            }`}
          >
            <input
              type="color"
              value={bg === "transparent" ? "#ffffff" : bg}
              onChange={(event) => chooseBackground(event.target.value)}
              className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Custom menu bar color"
            />
            Custom
          </label>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          The top menu on your studio page, booking pages, and client galleries uses this color, with your logo right
          on it. Pick one your logo stands out on.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
