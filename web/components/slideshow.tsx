"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SECONDS, SPEEDS, step } from "@/lib/slideshow";

// A full-screen slideshow of a gallery's final photos: each photo fades into
// the next with a slow, gentle zoom, set to the studio's song when there is
// one. Play/pause, back and forward, speed, and sound controls fade away
// while it plays. Keys: space, ← →, Esc. On phones: swipe, tap for controls.
// The screen is kept awake while it plays.
export function Slideshow({
  photos,
  songUrl,
  title,
  startIndex = 0,
  onClose,
}: {
  photos: { id: string; url: string }[];
  songUrl: string | null;
  title: string;
  startIndex?: number;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  // The photo showing, and the one it's fading in over.
  const [view, setView] = useState<{ index: number; previous: number | null }>({ index: startIndex, previous: null });
  const { index, previous } = view;
  const [playing, setPlaying] = useState(true);
  const [seconds, setSeconds] = useState<number>(DEFAULT_SECONDS);
  const [muted, setMuted] = useState(false);
  const [controls, setControls] = useState(true);
  const hideTimer = useRef<number | undefined>(undefined);
  const swipeFrom = useRef<number | null>(null);
  const count = photos.length;

  const go = useCallback((by: 1 | -1) => setView((v) => ({ previous: v.index, index: step(v.index, count, by) })), [count]);

  // Controls show on any movement, and fade after a few seconds while playing.
  const wake = useCallback(() => {
    setControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControls(false), 3000);
  }, []);

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    onClose();
  }, [onClose]);

  // Next photo after `seconds`, while playing.
  useEffect(() => {
    if (!playing || count < 2) return;
    const timer = window.setTimeout(() => go(1), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, seconds, index, count, go]);

  // Load the next photo ahead of time so the fade never waits on it.
  useEffect(() => {
    if (count < 2) return;
    const next = new Image();
    next.src = photos[step(index, count, 1)].url;
  }, [index, count, photos]);

  // The song follows play / pause.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.play().catch(() => setMuted(true));
    else audio.pause();
  }, [playing]);

  // Full screen, keys, and keeping the screen awake while it plays.
  useEffect(() => {
    rootRef.current?.requestFullscreen?.().catch(() => undefined);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else return;
      wake();
    };
    // Leaving full screen with the browser's own Esc closes the slideshow too.
    const onFullscreen = () => !document.fullscreenElement && onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    hideTimer.current = window.setTimeout(() => setControls(false), 3000);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.body.style.overflow = "";
      window.clearTimeout(hideTimer.current);
    };
  }, [close, go, wake, onClose]);

  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, [playing]);

  const speedLabel = SPEEDS.find((s) => s.seconds === seconds)?.label ?? "Normal";
  const nextSpeed = () => setSeconds(SPEEDS[(SPEEDS.findIndex((s) => s.seconds === seconds) + 1) % SPEEDS.length].seconds);
  const button = "grid size-12 place-items-center rounded-full bg-white/10 text-xl text-white backdrop-blur transition hover:bg-white/25";

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Slideshow: ${title}`}
      className={`fixed inset-0 z-[100] overflow-hidden bg-black select-none ${controls ? "" : "cursor-none"}`}
      onMouseMove={wake}
      onPointerDown={(e) => (swipeFrom.current = e.clientX)}
      onPointerUp={(e) => {
        const from = swipeFrom.current;
        swipeFrom.current = null;
        if (from === null) return;
        const moved = e.clientX - from;
        if (Math.abs(moved) > 50) go(moved < 0 ? 1 : -1);
        wake();
      }}
    >
      <style>{`@keyframes pez-slide-zoom { from { transform: scale(1); } to { transform: scale(1.08); } } @keyframes pez-slide-fade { from { opacity: 0; } to { opacity: 1; } }`}</style>
      {songUrl && <audio ref={audioRef} src={songUrl} loop muted={muted} preload="auto" />}

      {[previous, index].map((i, layer) =>
        i === null || (layer === 0 && i === index) ? null : (
          // Signed links to pre-sized photos; next/image isn't needed here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${photos[i].id}-${layer === 1 ? "now" : "before"}`}
            src={photos[i].url}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full object-contain"
            // The new photo fades in over the one before, then slowly zooms.
            style={
              layer === 1
                ? {
                    animation: `pez-slide-fade 1.2s ease both, pez-slide-zoom ${seconds + 1.2}s ease-out both`,
                    animationPlayState: playing ? "running" : "paused",
                  }
                : { transform: "scale(1.08)" }
            }
          />
        ),
      )}

      <div className={`absolute inset-x-0 top-0 flex items-center justify-between gap-4 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-500 sm:p-6 ${controls ? "opacity-100" : "opacity-0"}`}>
        <p className="min-w-0 truncate font-display text-lg text-white">
          {title}
          <span className="ml-3 text-sm text-white/60">
            {index + 1} / {count}
          </span>
        </p>
        <button type="button" onClick={close} aria-label="Close slideshow" className={button}>
          ✕
        </button>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-6 transition-opacity duration-500 ${controls ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={button}>
          ‹
        </button>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-16 place-items-center rounded-full bg-lime text-2xl text-brand-deep shadow-lg transition hover:scale-105"
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next photo" className={button}>
          ›
        </button>
        <button type="button" onClick={nextSpeed} className="h-12 rounded-full bg-white/10 px-4 text-xs font-bold tracking-wider text-white uppercase backdrop-blur hover:bg-white/25">
          {speedLabel}
        </button>
        {songUrl && (
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Turn sound on" : "Turn sound off"} className={button}>
            {muted ? "🔇" : "🔊"}
          </button>
        )}
      </div>
    </div>
  );
}
