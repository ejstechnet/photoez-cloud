"use client";

import { useEffect, useRef, useState } from "react";
import type { StoreLabDesign, StoreVariant } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { finishGalleryDesign, startGalleryDesign } from "../actions";
import type { ShopPhoto } from "./shop-dialog";

// The gallery designer: the shared swagg-designer (built in the
// swagg-designer project and copied to public/vendor), full screen over the
// gallery. When the client is done, its pictures upload straight to storage
// and the design is saved for the cart (lib/store/designs.ts).

// Bump when a new designer build is copied in, so browsers load it fresh.
const DESIGNER_URL = "/vendor/swagg-designer.js?v=2026-09-28m";

export type SavedDesign = { id: string; previewUrl: string; design: unknown; printStyle: "panel" | "wrap" };

type DesignResult = {
  design: unknown;
  preview: Blob;
  printFiles: { front: Blob; back?: Blob };
  photoIds: string[];
  printStyle: "panel" | "wrap";
};

type SwaggDesignerGlobal = {
  mount: (el: HTMLElement, options: Record<string, unknown>) => { destroy: () => void };
};

let loading: Promise<SwaggDesignerGlobal> | null = null;

function loadDesigner(): Promise<SwaggDesignerGlobal> {
  const existing = (window as unknown as { SwaggDesigner?: SwaggDesignerGlobal }).SwaggDesigner;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = DESIGNER_URL;
    script.async = true;
    script.onload = () => {
      const loaded = (window as unknown as { SwaggDesigner?: SwaggDesignerGlobal }).SwaggDesigner;
      if (loaded) resolve(loaded);
      else reject(new Error("The designer didn't load."));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("The designer couldn't be loaded. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

async function upload(url: string, file: Blob) {
  const response = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": "image/png" } });
  if (!response.ok) throw new Error("Your design couldn't be uploaded. Please try again.");
}

export function DesignerOverlay({
  token,
  productId,
  productName,
  setup,
  variant,
  photos,
  startPhotoId,
  initialDesign,
  onSaved,
  onClose,
}: {
  token: string;
  productId: string;
  productName: string;
  setup: StoreLabDesign;
  variant: StoreVariant;
  photos: ShopPhoto[];
  startPhotoId: string;
  initialDesign: unknown;
  onSaved: (design: SavedDesign) => void;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let handle: { destroy: () => void } | null = null;
    let cancelled = false;
    // No scrolling the gallery behind the designer.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    loadDesigner()
      .then((designer) => {
        if (cancelled || !host.current) return;
        const inches = variant.widthIn && variant.heightIn ? { w: variant.widthIn, h: variant.heightIn } : null;
        handle = designer.mount(host.current, {
          product: {
            name: `${productName} · ${variant.label}`,
            canvas: setup.canvas,
            front: { mockup: variant.labImage || setup.front.mockup, area: setup.front.area },
            back: setup.back,
            fullWrap: setup.fullWrap,
            // Wraps use SwaggPress's wrap size when it's set.
            printInches: setup.fullWrap ? (setup.wrapInches ?? inches) : inches,
            // "Customer chooses": front & back, or a full wrap for the upcharge.
            wrapChoice: setup.wrapChoice
              ? { upcharge: setup.wrapUpchargeCents ? `+${formatPrice(setup.wrapUpchargeCents)}` : null, wrapInches: setup.wrapInches ?? null }
              : null,
            printPx: setup.printPx ? { w: setup.printPx.w, h: setup.printPx.h } : null,
            dpi: setup.printPx?.dpi ?? 300,
          },
          colors: variant.colorHex ? [{ id: variant.id, label: variant.label, hex: variant.colorHex }] : undefined,
          photos: photos.map((p) => ({ id: p.id, name: `Photo ${p.number}`, url: `/g/${token}/shop/photo/${p.id}`, thumbUrl: p.thumbUrl })),
          startPhotoId,
          initialDesign,
          whiteLabel: true,
          doneLabel: "Use this design",
          onCancel: onClose,
          onDone: async (result: DesignResult) => {
            const started = await startGalleryDesign(token, productId, Boolean(result.printFiles.back));
            if ("error" in started) throw new Error(started.error);
            const { uploads } = started;
            await Promise.all([
              upload(uploads.preview!, result.preview),
              upload(uploads.front!, result.printFiles.front),
              ...(uploads.back && result.printFiles.back ? [upload(uploads.back, result.printFiles.back)] : []),
            ]);
            const saved = await finishGalleryDesign(token, {
              designId: started.designId,
              productId,
              design: result.design,
              photoIds: result.photoIds,
            });
            if ("error" in saved) throw new Error(saved.error);
            onSaved({ id: saved.id, previewUrl: saved.previewUrl, design: result.design, printStyle: result.printStyle });
          },
        });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      handle?.destroy();
      document.body.style.overflow = overflow;
    };
    // Mounted once per opening; the dialog closes and reopens it for changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={`Design your ${productName}`}>
      {error ? (
        <div className="m-auto max-w-md p-6 text-center">
          <p className="font-semibold">{error}</p>
          <button type="button" className="btn-primary mt-4" onClick={onClose}>
            Go back
          </button>
        </div>
      ) : (
        <div ref={host} className="min-h-0 flex-1" />
      )}
    </div>
  );
}
