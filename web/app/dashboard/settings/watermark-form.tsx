"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { FormError, SelectField, SubmitButton } from "@/components/form";
import { POSITION_LABELS, WATERMARK_POSITIONS, watermarkBox, type WatermarkPosition } from "@/lib/watermark";
import { prepareWatermarkUpload, removeWatermark, saveWatermarkSettings, type WatermarkFormState } from "./actions";

type Props = {
  currentUrl: string | null;
  opacity: number;
  position: WatermarkPosition;
};

// Draw a stand-in portrait "photo" with the watermark on top, using the exact
// placement rules the real proofs use.
function drawPreview(canvas: HTMLCanvasElement, watermark: ImageBitmap | null, opacity: number, position: WatermarkPosition) {
  const context = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#1e7ce0");
  sky.addColorStop(0.55, "#bfe3fb");
  sky.addColorStop(0.56, "#46c12f");
  sky.addColorStop(1, "#1a3a6b");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#ffc53d";
  context.beginPath();
  context.arc(width * 0.7, height * 0.22, width * 0.09, 0, Math.PI * 2);
  context.fill();

  if (!watermark) return;
  // Scale the 40px margin down to this small preview so it looks like a real 2048px proof.
  const scale = width / 1366;
  const box = watermarkBox(width / scale, height / scale, watermark.width, watermark.height, position);
  context.globalAlpha = opacity / 100;
  context.drawImage(watermark, box.x * scale, box.y * scale, box.width * scale, box.height * scale);
  context.globalAlpha = 1;
}

export function WatermarkForm({ currentUrl, opacity: savedOpacity, position: savedPosition }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState<{ source: File | string; bitmap: ImageBitmap } | null>(null);
  const [opacity, setOpacity] = useState(savedOpacity);
  const [position, setPosition] = useState<WatermarkPosition>(savedPosition);
  const [removing, startRemove] = useTransition();

  // Show whichever watermark applies: a newly chosen file, or the saved one.
  const source = file ?? currentUrl;
  const watermark = loaded && loaded.source === source ? loaded.bitmap : null;

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    (async () => {
      const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
      const bitmap = await createImageBitmap(blob);
      if (!cancelled) setLoaded({ source, bitmap });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (canvasRef.current) drawPreview(canvasRef.current, watermark, opacity, position);
  }, [watermark, opacity, position]);

  const [state, formAction, pending] = useActionState(
    async (prev: WatermarkFormState, formData: FormData): Promise<WatermarkFormState> => {
      if (file) {
        const prepared = await prepareWatermarkUpload({ type: file.type, size: file.size });
        if ("error" in prepared) return { message: prepared.error };
        const upload = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: file });
        if (!upload.ok) return { message: "The watermark didn't upload. Try again." };
        formData.set("newVersion", prepared.version);
      }
      const result = await saveWatermarkSettings(prev, formData);
      if (result.saved) setFile(null);
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="grid gap-8 md:grid-cols-[1fr_240px]">
      <div className="space-y-5">
        <div>
          <span className="text-sm font-semibold">Watermark image</span>
          <label className="mt-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed border-border bg-surface px-4 py-3 transition hover:border-lime">
            <span className="truncate text-sm">
              {file ? file.name : currentUrl ? "Replace your watermark…" : "Choose a PNG…"}
            </span>
            <span className="shrink-0 text-xs font-bold tracking-wider text-lime-ink uppercase">Browse</span>
            <input
              type="file"
              accept="image/png"
              hidden
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <span className="mt-1.5 block text-xs text-muted">
            PNG with a transparent background works best, like your logo in white.
          </span>
        </div>

        <label className="block">
          <span className="flex justify-between text-sm font-semibold">
            Opacity <span className="text-muted">{opacity}%</span>
          </span>
          <input
            type="range"
            name="opacity"
            min={5}
            max={100}
            step={5}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            className="mt-3 w-full accent-lime"
          />
        </label>

        <SelectField
          label="Position"
          name="position"
          value={position}
          onChange={(event) => setPosition(event.target.value as WatermarkPosition)}
        >
          {WATERMARK_POSITIONS.map((value) => (
            <option key={value} value={value}>
              {POSITION_LABELS[value]}
            </option>
          ))}
        </SelectField>

        <FormError message={state.message} />
        {state.saved && !pending && (
          <p role="status" className="rounded-xl bg-lime/15 px-4 py-2.5 text-sm font-semibold text-lime-ink">
            Watermark saved. Open a gallery and click “Update proofs” to apply it to photos already uploaded.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton pending={pending} fullWidth={false}>
            Save watermark
          </SubmitButton>
          {currentUrl && (
            <button
              type="button"
              disabled={removing}
              onClick={() => confirm("Remove your watermark? Clients will see clean proofs.") && startRemove(() => removeWatermark())}
              className="text-xs font-bold tracking-wider text-danger uppercase hover:underline"
            >
              {removing ? "Removing…" : "Remove watermark"}
            </button>
          )}
        </div>
      </div>

      <div>
        <span className="text-sm font-semibold">Preview</span>
        <canvas
          ref={canvasRef}
          width={240}
          height={360}
          className="mt-1.5 w-full rounded-2xl shadow-lg"
          aria-label="Preview of the watermark on a sample portrait proof"
        />
        {!watermark && <p className="mt-2 text-xs text-muted">Choose a PNG to see it here.</p>}
      </div>
    </form>
  );
}
