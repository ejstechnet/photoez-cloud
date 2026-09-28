"use client";

import { Children, useEffect, useState } from "react";

const SECONDS_PER_REVIEW = 7;

// The studio page's reviews, one at a time: moves on by itself every few
// seconds (paused while the visitor points at it or uses the arrows, and
// never for people who ask their device to reduce motion), with arrows and
// dots to move by hand. All reviews share one spot, so the section keeps the
// tallest review's height and the page below never jumps.
export function ReviewRotator({ children }: { children: React.ReactNode }) {
  const slides = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), SECONDS_PER_REVIEW * 1000);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;
  const go = (next: number) => {
    setIndex((next + count) % count);
    setPaused(true);
  };
  const arrow =
    "flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface text-lg font-bold transition hover:border-brand";

  return (
    <div
      className="mt-4"
      role="region"
      aria-roledescription="carousel"
      aria-label="Client reviews"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
    >
      <div className="grid">
        {slides.map((slide, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            inert={i !== index}
            className={`[grid-area:1/1] transition-opacity duration-700 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {slide}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(index - 1)} className={arrow} aria-label="Previous review">
            ‹
          </button>
          <div className="flex flex-wrap justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show review ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={`h-2.5 rounded-full transition-all ${i === index ? "w-6 bg-lime" : "w-2.5 bg-border hover:bg-muted"}`}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(index + 1)} className={arrow} aria-label="Next review">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
