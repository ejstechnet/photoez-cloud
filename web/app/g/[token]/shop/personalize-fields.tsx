"use client";

import type { StoreLabField } from "@/db/schema";
import { shownFields } from "@/lib/store/rules";
import type { ShopPhoto } from "./shop-dialog";

// "Personalize": the fields a SwaggPress Custom Text & Photos product asks for
// (text, dropdowns, and photo fields filled from this gallery), as set up on
// SwaggPress. Fields with "show only when" appear once that choice is made.
export function PersonalizeFields({
  fields,
  optionPicks,
  answers,
  onAnswer,
  photoPicks,
  onPhotos,
  photos,
}: {
  fields: StoreLabField[];
  optionPicks: Record<string, string>;
  answers: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
  photoPicks: Record<string, string[]>;
  onPhotos: (key: string, ids: string[]) => void;
  photos: ShopPhoto[];
}) {
  const visible = shownFields(fields, optionPicks, answers);
  const inputClass = "mt-1.5 h-11 w-full rounded-xl border-2 border-border bg-background px-3";

  return (
    <div className="mt-3 space-y-5">
      {visible.map((f) => (
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
                {f.placeholder ? `${f.placeholder} · ` : ""}Tap {f.max === 1 ? "a photo" : `up to ${f.max} photos`} from your gallery.{" "}
                <strong className="text-foreground">
                  {(photoPicks[f.key] ?? []).length} of {f.max} chosen
                </strong>
              </p>
              <div className="mt-2 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                {photos.map((p) => {
                  const chosen = (photoPicks[f.key] ?? []).includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={chosen}
                      aria-label={`Photo ${p.number}${chosen ? ", chosen" : ""}`}
                      className={`relative aspect-square overflow-hidden rounded-xl border-4 ${chosen ? "border-lime" : "border-transparent"}`}
                      onClick={() => {
                        const current = photoPicks[f.key] ?? [];
                        if (chosen) onPhotos(f.key, current.filter((id) => id !== p.id));
                        else if (f.max === 1) onPhotos(f.key, [p.id]);
                        else if (current.length < f.max) onPhotos(f.key, [...current, p.id]);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumbUrl} alt="" className="size-full object-cover" />
                      {chosen && <span className="absolute top-1 right-1 rounded-full bg-lime px-1.5 text-xs font-bold text-on-accent">✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
