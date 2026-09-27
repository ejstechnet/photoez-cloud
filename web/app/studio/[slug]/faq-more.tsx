"use client";

import { useState } from "react";

// The rest of a long FAQ: "Show all N questions" opens it, and "Show fewer
// questions" (at the bottom) closes it again and returns to the FAQ's top.
export function FaqMore({ total, children }: { total: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const link = "mt-3 text-sm font-bold tracking-wider text-link uppercase hover:underline";
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={link} aria-expanded={false}>
        Show all {total} questions
      </button>
    );
  }
  return (
    <>
      {children}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          document.getElementById("faq")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        className={link}
        aria-expanded
      >
        Show fewer questions
      </button>
    </>
  );
}
