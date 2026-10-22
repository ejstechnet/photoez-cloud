"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { inputClass } from "@/components/form";
import { READY_MESSAGE, readCaptureMessage, splitPasted, tidyTitle } from "@/lib/growth/capture";
import { platformFromUrl } from "@/lib/growth/urls";
import { PostForm, type PostPrefill } from "../new/post-form";

type Source = { id: string; name: string; platform: string };

// Whether a page opened this window (the bookmark did), read in the browser
// only; null while rendering on the server.
const noSubscribe = () => () => {};
const useOpened = () =>
  useSyncExternalStore(
    noSubscribe,
    () => Boolean(window.opener),
    () => null,
  );

// The bookmark's window: tells the page that opened it "ready", fills the
// form from what it sends back, and offers a paste box as the backup.
export function CaptureForm({ sources }: { sources: Source[] }) {
  const [prefill, setPrefill] = useState<PostPrefill>();
  const [prefillKey, setPrefillKey] = useState(0);
  const connected = useOpened();

  // A source on the same platform as the link (e.g. the Facebook group).
  const sourceFor = (url: string) => {
    const platform = platformFromUrl(url);
    return sources.find((s) => s.platform === platform)?.id ?? sources[0]?.id;
  };

  const fill = (p: PostPrefill) => {
    setPrefill(p);
    setPrefillKey((k) => k + 1);
  };

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (!opener) return;

    const onMessage = (event: MessageEvent) => {
      // Only the window that opened this one, and only a capture message;
      // even then it just fills the form for Elle to check.
      if (event.source !== opener) return;
      const captured = readCaptureMessage(event.data);
      if (!captured) return;
      fill({ url: captured.url, title: tidyTitle(captured.title), excerpt: captured.text, sourceId: sourceFor(captured.url) });
    };
    window.addEventListener("message", onMessage);
    // The bookmark checks where this came from; the message carries nothing.
    opener.postMessage({ type: READY_MESSAGE }, "*");
    return () => window.removeEventListener("message", onMessage);
    // Runs once: sources don't change while the window is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {!prefill && (
        <div className="rounded-xl bg-sky/10 p-4 text-sm">
          <p className="font-semibold">{connected ? "Waiting for the post…" : "Paste the post here"}</p>
          <p className="mt-1 text-muted">
            {connected
              ? "If nothing appears in a moment, that site blocked the hand-off. Click in the box below and press Ctrl+V: the bookmark copied the link and text for you."
              : "The bookmark copied the link and the text you highlighted. Click in the box and press Ctrl+V."}
          </p>
          <textarea
            rows={3}
            aria-label="Paste the link and text"
            placeholder="Paste here"
            className={`mt-3 ${inputClass}`}
            onPaste={(e) => {
              const { url, text } = splitPasted(e.clipboardData.getData("text"));
              if (!url && !text) return;
              e.preventDefault();
              fill({ url, excerpt: text, sourceId: url ? sourceFor(url) : undefined });
            }}
          />
        </div>
      )}
      <PostForm sources={sources} prefill={prefill} prefillKey={prefillKey} mode="capture" />
    </div>
  );
}
