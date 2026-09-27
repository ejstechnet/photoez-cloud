// Turns an email's pieces (plain text only) into the HTML and plain-text
// versions that get sent. Everything is escaped here, so message builders
// never write HTML themselves.

export type EmailContent = {
  subject: string;
  // Big title at the top; left out for letter-style emails like inquiry replies.
  heading?: string;
  // Paragraphs of plain text. Links in them become clickable.
  intro: string[];
  // Label/value rows, e.g. ["When", "Saturday, October 3 at 10:00 AM"].
  details?: [string, string][];
  button?: { label: string; url: string };
  // Paragraphs after the button.
  outro?: string[];
};

export type RenderedEmail = { subject: string; html: string; text: string };

const NAVY = "#0f2548";
const LIME = "#46c12f";
const INK = "#17171d";
const MUTED = "#5b6477";

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escapes a paragraph, keeps its line breaks, and makes http(s) links clickable.
export function paragraphHtml(text: string) {
  return escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g, (url) => `<a href="${url}" style="color:${NAVY};font-weight:600">${url}</a>`)
    .replace(/\n/g, "<br>");
}

// Splits a block of text (like an AI reply) into paragraphs on blank lines.
export function toParagraphs(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// The studio's logo at the top of the email, on its chosen card color
// ("transparent" puts it straight on the navy band, like the studio page).
export type EmailLogo = { url: string; background: string };

export function renderEmail(
  content: EmailContent,
  from: { studioName: string; footer: string; logo?: EmailLogo | null },
): RenderedEmail {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${paragraphHtml(text)}</p>`;

  const details = content.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 24px;border:1px solid #d8dee8;border-radius:12px;border-collapse:separate">${content.details
        .map(
          ([label, value], i) =>
            `<tr><td style="padding:10px 16px;font-size:13px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;vertical-align:top;${i ? "border-top:1px solid #d8dee8" : ""}">${escapeHtml(label)}</td><td style="padding:10px 16px;font-size:15px;color:${INK};${i ? "border-top:1px solid #d8dee8" : ""}">${paragraphHtml(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:${LIME}"><a href="${escapeHtml(content.button.url)}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${NAVY};text-decoration:none">${escapeHtml(content.button.label)} &rarr;</a></td></tr></table>`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:#eceff5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eceff5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px">
<tr><td style="background:${NAVY};border-radius:20px 20px 0 0;padding:20px 32px">${headerHtml(from.studioName, from.logo)}</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 20px 20px;padding:32px">
${content.heading ? `<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:${NAVY}">${escapeHtml(content.heading)}</h1>` : ""}
${content.intro.map(p).join("\n")}
${details}
${button}
${(content.outro ?? []).map(p).join("\n")}
</td></tr>
<tr><td style="padding:18px 32px;font-size:12px;line-height:1.5;color:${MUTED};text-align:center">${paragraphHtml(from.footer)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    content.heading,
    ...content.intro,
    content.details?.map(([label, value]) => `${label}: ${value}`).join("\n"),
    content.button ? `${content.button.label}: ${content.button.url}` : undefined,
    ...(content.outro ?? []),
    "--",
    from.footer,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

  return { subject: content.subject, html, text };
}

function headerHtml(studioName: string, logo?: EmailLogo | null) {
  const name = `<span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:#ffffff">${escapeHtml(studioName)}</span>`;
  if (!logo) return name;
  const background = /^#[0-9a-f]{3,8}$/i.test(logo.background) ? logo.background : "transparent";
  const card = background === "transparent" ? "" : `background:${background};border-radius:12px;padding:8px;`;
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="${card}vertical-align:middle"><img src="${escapeHtml(logo.url)}" alt="${escapeHtml(studioName)}" height="56" style="display:block;height:56px;width:auto;max-width:240px;border:0"></td><td style="padding-left:16px;vertical-align:middle">${name}</td></tr></table>`;
}
