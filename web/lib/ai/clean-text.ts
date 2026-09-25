// Repairs text glitches the model occasionally writes into a draft reply, so
// a client never sees them. Seen in the triage eval (September 2026): an
// escape code instead of a dash ("—"), a dash garbled by the wrong text
// encoding ("‚Äî"), and a full-width comma ("，"). These are deterministic
// fixes for specific, known garbles; they never rewrite wording.

// UTF-8 punctuation misread as Windows-1252 or Mac Roman, and what it should be.
// Longest patterns first: "â€" alone (a garbled ”) is a prefix of the others.
const GARBLED: [string, string][] = [
  ["â€”", "—"],
  ["â€“", "–"],
  ["â€˜", "‘"],
  ["â€™", "’"],
  ["â€œ", "“"],
  ["â€¦", "…"],
  ["â€", "”"],
  ["‚Äî", "—"],
  ["‚Äì", "–"],
  ["‚Äò", "‘"],
  ["‚Äô", "’"],
  ["‚Äú", "“"],
  ["‚Äù", "”"],
  ["‚Ä¶", "…"],
  ["Ã©", "é"],
  ["√©", "é"],
  ["Â ", " "],
  ["¬†", " "],
];

export function cleanReplyText(text: string): string {
  let out = text
    // "—" written out as characters instead of the dash itself.
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    // "：" written without the "u": it arrives as a form-feed control
    // character followed by "f1a". Rebuild the intended character (here U+FF1A,
    // a full-width colon), which the next step turns into a normal ":".
    .replace(/\f([0-9a-fA-F]{3})/g, (_, hex: string) => String.fromCharCode(parseInt(`f${hex}`, 16)))
    // Any other invisible control characters (keeping line breaks and tabs).
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    // Full-width punctuation and letters (U+FF01–FF5E) back to their normal forms.
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  for (const [bad, good] of GARBLED) out = out.replaceAll(bad, good);
  return out;
}

// True when the text still contains any of the glitches above (used by the eval).
export function hasGarbledText(text: string): boolean {
  return cleanReplyText(text) !== text;
}
