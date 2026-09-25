"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary print:hidden">
      Print / Save as PDF
    </button>
  );
}
