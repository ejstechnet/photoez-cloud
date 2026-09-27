"use client";

import { useState, useTransition } from "react";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { REVIEW_MAX_CHARS } from "@/lib/reviews";
import { submitReview } from "./actions";

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Great", "Amazing!"];

// Stars, a few words, the name to show, and (optionally) one of their photos.
export function ReviewForm({
  token,
  studioName,
  suggestedName,
  photos,
}: {
  token: string;
  studioName: string;
  suggestedName: string;
  photos: { id: string; name: string; url: string }[];
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ googleUrl: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = String(new FormData(event.currentTarget).get("displayName") ?? "");
    setError(null);
    startTransition(async () => {
      const result = await submitReview(token, { rating, body, displayName, photoId, photoConsent: consent });
      if ("error" in result) setError(result.error);
      else setDone({ googleUrl: result.googleUrl });
    });
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-5xl">💛</p>
        <h2 className="mt-4 font-display text-3xl font-bold">Thank you!</h2>
        <p className="mt-3 text-muted">
          {studioName} has your review. It means a lot and helps other clients find them.
        </p>
        {done.googleUrl && (
          <>
            <p className="mt-6 text-sm font-semibold">Would you share it on Google too? It helps even more.</p>
            <a href={done.googleUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3">
              Post on Google
            </a>
          </>
        )}
      </div>
    );
  }

  const shown = hover || rating;
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold">Your rating</legend>
        <div className="mt-2 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              aria-pressed={rating === star}
              className={`text-4xl leading-none transition hover:scale-110 ${star <= shown ? "text-sun" : "text-border"}`}
            >
              ★
            </button>
          ))}
          <span className="ml-3 text-sm font-semibold text-muted">{RATING_WORDS[shown]}</span>
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-semibold">Your review</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={6}
          maxLength={REVIEW_MAX_CHARS}
          required
          placeholder="What was your session like? How do you feel about your photos?"
          className={`mt-1.5 ${inputClass}`}
        />
        <span className="mt-1 block text-right text-xs text-muted">
          {body.length}/{REVIEW_MAX_CHARS}
        </span>
      </label>

      <Field
        label="Name to show with your review"
        name="displayName"
        defaultValue={suggestedName}
        maxLength={60}
        required
        hint="We suggest your first name and last initial."
      />

      {photos.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold">Add a favorite photo (optional)</legend>
          <p className="mt-1 text-xs text-muted">Pick one of your photos to show with your review.</p>
          <div className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto rounded-2xl border-2 border-border p-2 sm:grid-cols-4">
            {photos.map((photo) => {
              const selected = photoId === photo.id;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setPhotoId(selected ? null : photo.id)}
                  aria-pressed={selected}
                  aria-label={`Use ${photo.name}`}
                  className={`relative aspect-square overflow-hidden rounded-xl ring-offset-2 transition ${
                    selected ? "ring-4 ring-lime" : "hover:opacity-80"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="size-full object-cover" />
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-lime text-sm font-bold text-on-accent">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {photoId && (
            <label className="mt-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 size-4 accent-lime-ink"
              />
              <span className="text-sm">
                I give {studioName} permission to show this photo with my review on their website.
              </span>
            </label>
          )}
        </fieldset>
      )}

      <FormError message={error} />
      <SubmitButton pending={pending}>Send my review</SubmitButton>
    </form>
  );
}
