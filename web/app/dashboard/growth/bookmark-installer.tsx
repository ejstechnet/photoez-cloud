"use client";

import { useEffect, useRef, useState } from "react";

// The "Save to PhotoEZ Growth" button to drag onto the bookmarks bar, plus a
// copy-the-code fallback. React refuses javascript: links in JSX (a safety
// rule), so the link's address is set directly once it's on the page.
export function BookmarkInstaller({ code }: { code: string }) {
  const link = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    link.current?.setAttribute("href", code);
  }, [code]);

  return (
    <details className="card mt-6 p-5">
      <summary className="cursor-pointer font-semibold">Save posts in one click</summary>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm">
        <li>
          Show your bookmarks bar (Ctrl+Shift+B in Chrome or Edge), then <strong>drag this button onto it</strong>:{" "}
          <a
            ref={link}
            onClick={(e) => e.preventDefault()}
            className="ml-1 inline-flex cursor-grab items-center rounded-full bg-lime px-4 py-1.5 text-xs font-bold tracking-wider text-brand-deep uppercase"
          >
            Save to PhotoEZ Growth
          </a>
        </li>
        <li>
          On Facebook, open the post itself (click the time under the poster&apos;s name), so the address bar shows that post.
        </li>
        <li>Highlight the post&apos;s text, then click the bookmark. A small window opens with everything filled in.</li>
        <li>Check it, pick the source, and click Save post.</li>
      </ol>
      <p className="mt-4 text-sm text-muted">
        Can&apos;t drag it? Add a bookmark by hand, name it &ldquo;Save to PhotoEZ Growth&rdquo;, and paste this as its address:{" "}
        <button
          type="button"
          className="link font-semibold"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          }}
        >
          {copied ? "Copied ✓" : "copy the code"}
        </button>
      </p>
    </details>
  );
}
