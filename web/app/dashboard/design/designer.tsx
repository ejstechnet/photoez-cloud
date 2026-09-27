"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BODY_FONTS,
  CORNERS,
  DEFAULT_DESIGN,
  GALLERY_LAYOUTS,
  HEADING_FONTS,
  THEMES,
  bannerBackground,
  cleanDesign,
  designVars,
  fontsUrl,
  textOn,
  type BodyFont,
  type Design,
  type HeadingFont,
} from "@/lib/design";
import { galleryItemClass, galleryTileAspect } from "@/lib/gallery-layout";
import { renderJpeg } from "@/lib/proof-maker";
import { prepareBannerUpload, saveBannerPhoto, saveDesign } from "./actions";

const CORNER_LABELS = { rounded: "Rounded", soft: "Soft", square: "Square" } as const;
const LAYOUT_LABELS = { masonry: "Masonry", grid: "Even grid", large: "Large photos" } as const;
const BANNER_LABELS = { solid: "Solid color", gradient: "Gradient", photo: "Photo" } as const;

// The Page Designer: controls on the left, a live preview of the studio's
// pages on the right. Nothing changes for clients until Save.
export function Designer({
  initial,
  bannerPhotoUrl: initialBannerUrl,
  studioName,
  tagline,
  sampleUrls,
  studioUrl,
}: {
  initial: Design;
  bannerPhotoUrl: string | null;
  studioName: string;
  tagline: string | null;
  sampleUrls: string[];
  studioUrl: string | null;
}) {
  const router = useRouter();
  const [design, setDesign] = useState<Design>(initial);
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const clean = cleanDesign(design);
  const changed = JSON.stringify(clean) !== JSON.stringify(cleanDesign(initial));
  const set = (patch: Partial<Design>) => {
    setMessage(null);
    setDesign((d) => ({ ...d, ...patch }));
  };

  function save() {
    startSave(async () => {
      const result = await saveDesign(design);
      setMessage("ok" in result ? { ok: true, text: "Saved. Your pages now use this design." } : { ok: false, text: result.error });
      if ("ok" in result) router.refresh();
    });
  }

  async function uploadBanner(file: File) {
    setMessage(null);
    setUploading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const jpeg = await renderJpeg(bitmap, 2400, 0.85);
      bitmap.close();
      const prepared = await prepareBannerUpload(jpeg.size);
      if ("error" in prepared) throw new Error(prepared.error);
      const response = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: jpeg });
      if (!response.ok) throw new Error("The photo didn't upload. Try again.");
      const saved = await saveBannerPhoto(prepared.version);
      if ("error" in saved) throw new Error(saved.error);
      setBannerUrl(saved.url);
      set({ banner: "photo" });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "The photo didn't upload. Try again." });
    } finally {
      setUploading(false);
    }
  }

  const label = "text-sm font-semibold";
  const chip = (active: boolean) =>
    `rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition ${active ? "border-lime bg-lime/15" : "border-border hover:border-muted"}`;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[380px_1fr]">
      {/* ---- Controls ---- */}
      <div className="card space-y-7 p-6">
        <div>
          <p className={label}>Start from a theme</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.name}
                type="button"
                onClick={() => set({ ...theme.design })}
                className="flex items-center gap-2 rounded-xl border-2 border-border px-2.5 py-2 text-left text-sm font-semibold transition hover:border-lime"
              >
                <span className="flex shrink-0">
                  <span className="size-5 rounded-full border border-black/10" style={{ background: theme.design.main }} />
                  <span className="-ml-1.5 size-5 rounded-full border border-black/10" style={{ background: theme.design.accent }} />
                </span>
                {theme.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Main color" hint="Panels & dark areas" value={clean.main} onChange={(main) => set({ main })} />
          <ColorField label="Accent color" hint="Buttons & highlights" value={clean.accent} onChange={(accent) => set({ accent })} />
        </div>

        <div className="grid gap-4">
          <label className="block">
            <span className={label}>Heading font</span>
            <select
              value={clean.headingFont}
              onChange={(e) => set({ headingFont: e.target.value as HeadingFont })}
              className="mt-1.5 block w-full rounded-xl border-2 border-border bg-surface px-3 py-2"
            >
              {Object.keys(HEADING_FONTS).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Body font</span>
            <select
              value={clean.bodyFont}
              onChange={(e) => set({ bodyFont: e.target.value as BodyFont })}
              className="mt-1.5 block w-full rounded-xl border-2 border-border bg-surface px-3 py-2"
            >
              {Object.keys(BODY_FONTS).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className={label}>Buttons &amp; corners</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CORNERS.map((c) => (
              <button key={c} type="button" onClick={() => set({ corners: c })} className={chip(clean.corners === c)}>
                {CORNER_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={label}>Banner</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["solid", "gradient", "photo"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => (b === "photo" && !bannerUrl ? fileRef.current?.click() : set({ banner: b }))}
                className={chip(clean.banner === b)}
              >
                {BANNER_LABELS[b]}
              </button>
            ))}
          </div>
          {clean.banner !== "photo" ? (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <ColorField label={clean.banner === "gradient" ? "From" : "Color"} value={clean.bannerColor} onChange={(bannerColor) => set({ bannerColor })} />
              {clean.banner === "gradient" && (
                <ColorField label="To" value={clean.bannerColor2} onChange={(bannerColor2) => set({ bannerColor2 })} />
              )}
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary mt-3">
              {uploading ? "Uploading…" : "Change banner photo"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadBanner(file);
            }}
          />
        </div>

        <div>
          <p className={label}>Client gallery layout</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {GALLERY_LAYOUTS.map((l) => (
              <button key={l} type="button" onClick={() => set({ galleryLayout: l })} className={chip(clean.galleryLayout === l)}>
                {LAYOUT_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <p role="status" className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${message.ok ? "bg-lime/15 text-lime-ink" : "bg-danger/10 text-danger"}`}>
            {message.ok ? "✓ " : ""}
            {message.text}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <button type="button" onClick={save} disabled={saving || !changed} className="btn-primary">
            {saving ? "Saving…" : changed ? "Save design" : "Saved"}
          </button>
          <button
            type="button"
            onClick={() => set({ ...DEFAULT_DESIGN, bannerImageKey: design.bannerImageKey })}
            className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
          >
            Reset to classic
          </button>
          {studioUrl && (
            <a href={studioUrl} target="_blank" rel="noreferrer" className="ml-auto text-sm font-semibold text-link hover:underline">
              View studio page ↗
            </a>
          )}
        </div>
      </div>

      {/* ---- Live preview ---- */}
      <Preview design={clean} bannerUrl={bannerUrl} studioName={studioName} tagline={tagline} sampleUrls={sampleUrls} />
    </div>
  );
}

function ColorField({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <span className="mt-1.5 flex items-center gap-2 rounded-xl border-2 border-border bg-surface px-2 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-7 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="font-mono text-xs uppercase">{value}</span>
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// A small copy of the studio's pages in the chosen design.
function Preview({
  design,
  bannerUrl,
  studioName,
  tagline,
  sampleUrls,
}: {
  design: Design;
  bannerUrl: string | null;
  studioName: string;
  tagline: string | null;
  sampleUrls: string[];
}) {
  const fonts = fontsUrl(design);
  const photo = design.banner === "photo" && bannerUrl;
  const bannerDark = Boolean(photo) || textOn(design.bannerColor) === "#ffffff";
  const samples = sampleUrls.length > 0 ? sampleUrls.slice(0, 8) : [];
  const shapes = [1.5, 0.67, 1, 0.8, 1.33, 0.75, 1.2, 0.9];

  return (
    <div className="lg:sticky lg:top-6">
      <p className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Live preview</p>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      {fonts && <link rel="stylesheet" href={fonts} />}
      <div
        data-corners={design.corners}
        style={designVars(design) as React.CSSProperties}
        className="overflow-hidden rounded-3xl border border-border bg-background font-sans shadow-xl"
      >
        {/* Banner */}
        <div className={`relative ${bannerDark ? "text-white" : "text-[#111111]"}`} style={{ background: bannerBackground(design) }}>
          {photo && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerUrl!} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
            </>
          )}
          <div className={`relative px-6 ${photo ? "py-16" : "py-10"}`}>
            <p className={`text-xs font-bold tracking-wider uppercase ${bannerDark ? "text-white/75" : "text-black/60"}`}>Your area</p>
            <p className="mt-1 font-display text-4xl font-bold">{studioName}</p>
            {tagline && <p className={`mt-2 ${bannerDark ? "text-white/80" : "text-black/70"}`}>{tagline}</p>}
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {/* A card with buttons */}
          <div className="card p-5">
            <p className="font-display text-2xl font-bold">Book a session</p>
            <p className="mt-1 text-sm text-muted">Family photography with 15 edited photos.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-bold text-lime-ink">$200</span>
              <a className="rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider text-on-accent uppercase">Book now</a>
              <a className="btn-secondary px-4 py-2 text-xs">Details</a>
            </div>
          </div>
          {/* A main-color panel */}
          <div className="rounded-3xl bg-brand-deep p-5 text-white">
            <p className="font-display text-2xl font-bold">Let&apos;s talk</p>
            <p className="mt-1 text-sm text-white/75">Send a message and we&apos;ll get back to you.</p>
            <div className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-muted">Your name</div>
            <a className="btn-primary mt-3 w-full py-2 text-xs">Send message</a>
          </div>
        </div>

        {/* Gallery */}
        <div className="px-5 pb-6">
          <p className="font-display text-xl font-bold">Client gallery</p>
          {/* Fixed column counts: the preview is narrower than a real gallery page. */}
          <ul
            className={`mt-3 ${
              design.galleryLayout === "grid" ? "grid grid-cols-3 gap-2" : design.galleryLayout === "large" ? "columns-2 gap-3" : "columns-3 gap-2"
            }`}
          >
            {shapes.slice(0, design.galleryLayout === "large" ? 4 : 6).map((shape, i) => (
              <li key={i} className={galleryItemClass(design.galleryLayout)}>
                <div
                  className="overflow-hidden rounded-2xl bg-brand-deep/20"
                  style={{ aspectRatio: galleryTileAspect(design.galleryLayout, shape) }}
                >
                  {samples[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={samples[i]} alt="" className="size-full object-cover" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
