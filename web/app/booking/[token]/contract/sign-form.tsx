"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signContract } from "../actions";
import { signatureFont } from "./signature-font";

// Sign by drawing (finger, stylus, or mouse) or by typing a name, like
// PhotoEZ Photography Contracts. The server saves the exact contract shown.
export function SignForm({ token, defaultName }: { token: string; defaultName: string }) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // Size the canvas to its box, sharp on high-density screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f2548";
  }, [mode]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }

  function switchMode(next: "draw" | "type") {
    setMode(next);
    setHasDrawing(false);
  }

  function submit() {
    setMessage(null);
    if (mode === "draw" && !hasDrawing) {
      setMessage("Draw your signature in the box.");
      return;
    }
    const data = mode === "draw" ? (canvasRef.current?.toDataURL("image/png") ?? "") : name;
    startTransition(async () => {
      const result = await signContract(token, { signerName: name, type: mode, data, agreed });
      if (result?.message) setMessage(result.message);
    });
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold">Your full legal name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="mt-1.5 block w-full rounded-xl border-2 border-border bg-surface px-3.5 py-2.5 outline-none focus:border-lime-ink focus:ring-4 focus:ring-lime/25"
        />
      </label>

      <div>
        <div role="tablist" className="inline-flex rounded-full bg-background p-1">
          {(["draw", "type"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase transition ${
                mode === m ? "bg-brand text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {m === "draw" ? "Draw" : "Type"}
            </button>
          ))}
        </div>

        {mode === "draw" ? (
          <div className="mt-3">
            <canvas
              ref={canvasRef}
              aria-label="Signature pad: draw your signature"
              className="block h-40 w-full touch-none rounded-2xl border-2 border-dashed border-border bg-white"
              onPointerDown={(e) => {
                drawing.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                const ctx = e.currentTarget.getContext("2d")!;
                const { x, y } = point(e);
                ctx.beginPath();
                ctx.moveTo(x, y);
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                const ctx = e.currentTarget.getContext("2d")!;
                const { x, y } = point(e);
                ctx.lineTo(x, y);
                ctx.stroke();
                setHasDrawing(true);
              }}
              onPointerUp={() => (drawing.current = false)}
              onPointerLeave={() => (drawing.current = false)}
            />
            <button
              type="button"
              onClick={clear}
              className="mt-2 text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="mt-3 grid h-40 place-items-center rounded-2xl border-2 border-dashed border-border bg-white px-4">
            <span className={`${signatureFont.className} text-5xl text-brand-deep`}>{name || "Your name"}</span>
          </div>
        )}
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-4 accent-lime-ink"
        />
        <span className="text-sm">
          I have read this contract and agree to its terms. I understand my electronic signature is legally binding.
        </span>
      </label>

      {message && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
          {message}
        </p>
      )}
      <button type="button" onClick={submit} disabled={pending} className="btn-primary w-full">
        {pending ? "Signing…" : "Sign contract"}
      </button>
    </div>
  );
}
