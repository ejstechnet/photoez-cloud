"use client";

import { useState } from "react";
import type { StoreLabField } from "@/db/schema";
import { shownFields } from "@/lib/store/rules";
import { startShopUpload } from "../actions";
import type { ShopPhoto } from "./shop-dialog";

// "Personalize": the fields a SwaggPress Custom Text & Photos product asks for,
// as set up on SwaggPress: text, dropdowns, and photo fields. "Photo upload"
// fields take the client's own file (a school logo); "Photo from gallery"
// fields show this gallery's photos (and allow an upload too). Fields with
// "show only when" appear once that choice is made.
export function PersonalizeFields({
  token,
  fields,
  optionPicks,
  answers,
  onAnswer,
  photoPicks,
  onPhotos,
  photos,
}: {
  token: string;
  fields: StoreLabField[];
  optionPicks: Record<string, string>;
  answers: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
  // Per photo field: gallery photo ids and "upload:<file>" entries.
  photoPicks: Record<string, string[]>;
  onPhotos: (key: string, ids: string[]) => void;
  photos: ShopPhoto[];
}) {
  const visible = shownFields(fields, optionPicks, answers);
  const inputClass = "mt-1.5 h-11 w-full rounded-xl border-2 border-border bg-background px-3";
  // Previews of this visit's uploads (entry → local picture).
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ key: string; message: string } | null>(null);

  async function upload(f: StoreLabField, files: FileList | null) {
    const current = photoPicks[f.key] ?? [];
    const room = f.max === 1 ? 1 : f.max - current.length;
    const chosen = [...(files ?? [])].slice(0, Math.max(0, room));
    if (!chosen.length) return;
    setUploading(f.key);
    setUploadError(null);
    const added: string[] = [];
    try {
      for (const file of chosen) {
        const started = await startShopUpload(token, file.type, file.size);
        if ("error" in started) throw new Error(started.error);
        const res = await fetch(started.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!res.ok) throw new Error("That upload didn't work. Please try again.");
        added.push(started.entry);
        setPreviews((prev) => ({ ...prev, [started.entry]: URL.createObjectURL(file) }));
      }
    } catch (e) {
      setUploadError({ key: f.key, message: (e as Error).message });
    }
    if (added.length) onPhotos(f.key, f.max === 1 ? added.slice(-1) : [...current, ...added].slice(0, f.max));
    setUploading(null);
  }

  return (
    <div className="mt-3 space-y-5">
      {visible.map((f) => {
        const picks = photoPicks[f.key] ?? [];
        const uploads = picks.filter((p) => p.startsWith("upload:"));
        const fromGallery = f.type === "image" && f.source === "gallery";
        return (
          <div key={f.key}>
            <label className="block">
              <span className="font-semibold">
                {f.label}
                {f.required ? " *" : <span className="font-normal text-muted"> (optional)</span>}
              </span>
              {f.type === "text" && (
                <input
                  type="text"
                  className={inputClass}
                  maxLength={f.max}
                  placeholder={f.placeholder}
                  value={answers[f.key] ?? ""}
                  onChange={(e) => onAnswer(f.key, e.target.value)}
                />
              )}
              {f.type === "select" && (
                <select className={inputClass} value={answers[f.key] ?? ""} onChange={(e) => onAnswer(f.key, e.target.value)}>
                  <option value="">{f.placeholder || "Choose…"}</option>
                  {f.choices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {f.type === "image" && (
              <>
                <p className="mt-1 text-sm text-muted">
                  {f.placeholder ? `${f.placeholder} · ` : ""}
                  {fromGallery
                    ? `Tap ${f.max === 1 ? "a photo" : `up to ${f.max} photos`} from your gallery, or upload your own.`
                    : `Upload ${f.max === 1 ? "a file" : `up to ${f.max} files`} (JPG, PNG, WebP or GIF, up to 25 MB).`}{" "}
                  <strong className="text-foreground">
                    {picks.length} of {f.max} chosen
                  </strong>
                </p>

                {/* The client's uploads */}
                {uploads.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uploads.map((entry, i) => (
                      <div key={entry} className="relative size-20 overflow-hidden rounded-xl border-2 border-lime bg-white">
                        {previews[entry] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previews[entry]} alt={`Upload ${i + 1}`} className="size-full object-contain" />
                        ) : (
                          <span className="grid size-full place-items-center text-xs text-muted">Uploaded</span>
                        )}
                        <button
                          type="button"
                          className="absolute top-1 right-1 size-6 rounded-full bg-black/70 text-sm font-bold text-white"
                          aria-label="Remove this upload"
                          onClick={() => onPhotos(f.key, picks.filter((p) => p !== entry))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="btn-secondary mt-2 inline-flex cursor-pointer px-4 py-2 text-sm">
                  {uploading === f.key ? "Uploading…" : `⬆ Upload ${f.max === 1 ? "a file" : "files"}`}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple={f.max > 1}
                    className="hidden"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      void upload(f, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {uploadError?.key === f.key && <p className="mt-1 text-sm font-semibold text-danger">{uploadError.message}</p>}

                {/* Gallery photos, for "Photo from gallery" fields */}
                {fromGallery && (
                  <div className="mt-3 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                    {photos.map((p) => {
                      const chosen = picks.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={chosen}
                          aria-label={`Photo ${p.number}${chosen ? ", chosen" : ""}`}
                          className={`relative aspect-square overflow-hidden rounded-xl border-4 ${chosen ? "border-lime" : "border-transparent"}`}
                          onClick={() => {
                            if (chosen) onPhotos(f.key, picks.filter((id) => id !== p.id));
                            else if (f.max === 1) onPhotos(f.key, [p.id]);
                            else if (picks.length < f.max) onPhotos(f.key, [...picks, p.id]);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.thumbUrl} alt="" className="size-full object-cover" />
                          {chosen && <span className="absolute top-1 right-1 rounded-full bg-lime px-1.5 text-xs font-bold text-on-accent">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
