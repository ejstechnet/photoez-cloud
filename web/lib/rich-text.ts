import sanitizeHtml from "sanitize-html";

// Formatted text (studio bio, session descriptions) is stored as HTML from the
// editor. Anything that reaches the database or a public page goes through
// sanitizeRichText first, which keeps only simple formatting, so nobody can
// slip a script or tracking pixel onto a studio page.

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "hr"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // Links open in a new tab and don't pass any ranking or referrer to the target.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

// The words without any tags (never render this as HTML), e.g. to check that a
// field isn't just "<p></p>".
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html.replace(/<\/(p|h2|h3|li|blockquote)>|<br\s*\/?>/gi, "$&\n"), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Text saved before the editor existed is plain, with line breaks. Turn it
// into paragraphs so old and new text display the same way.
function plainToHtml(text: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const looksLikeHtml = (value: string) => /^\s*<(p|h2|h3|ul|ol|blockquote|hr)[\s>]/i.test(value);

// Safe HTML for display (and for loading into the editor).
export function richTextHtml(stored: string | null | undefined): string {
  if (!stored) return "";
  return looksLikeHtml(stored) ? sanitizeRichText(stored) : plainToHtml(stored);
}

// For form handling: clean HTML, or null when the editor was left empty.
export function cleanRichTextInput(html: string): string | null {
  const clean = sanitizeRichText(html.trim());
  return richTextToPlain(clean) === "" ? null : clean;
}
