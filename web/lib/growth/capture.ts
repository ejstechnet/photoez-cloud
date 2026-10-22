// The "Save to PhotoEZ Growth" bookmark: what it runs, and how the capture
// page reads what it sends. Tested in capture.test.ts.
//
// How it works: on a page Elle is reading (a Facebook group post, a forum
// thread), she highlights the post's text and clicks the bookmark. It opens
// PhotoEZ Cloud's capture page in a small window; when that page says it's
// ready, the bookmark hands it the page's link, title and the highlighted
// text with postMessage, so the text never goes in a URL or a server log.
// Nothing is saved until Elle clicks Save on the capture page.
//
// Backup: the bookmark also copies "link + text" to the clipboard. If the
// site cuts the connection to the window (some sites do, for security), Elle
// pastes into the capture page's paste box instead.

export const READY_MESSAGE = "photoez-growth-ready";
export const CAPTURE_MESSAGE = "photoez-growth-capture";

export const MAX_CAPTURE_TEXT = 10000;
const MAX_CAPTURE_URL = 2000;
const MAX_CAPTURE_TITLE = 300;

// The bookmark's code for this site (siteUrl). One line, as browsers need.
export function bookmarkletCode(origin: string): string {
  const o = JSON.stringify(origin);
  const source = `(()=>{
const o=${o},u=location.href,t=document.title,s=String(getSelection()).slice(0,${MAX_CAPTURE_TEXT});
try{const a=document.createElement("textarea");a.value=u+"\\n"+s;a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}catch(e){}
const w=window.open(o+"/dashboard/growth/capture","pezgrowth","width=600,height=800");
if(!w)return alert("Allow pop-ups for this site to use Save to PhotoEZ Growth.");
const f=e=>{if(e.origin===o&&e.source===w&&e.data&&e.data.type==="${READY_MESSAGE}")w.postMessage({type:"${CAPTURE_MESSAGE}",url:u,title:t,text:s},o)};
addEventListener("message",f);setTimeout(()=>removeEventListener("message",f),600000)
})()`;
  return `javascript:${source.replace(/\n/g, "")}`;
}

export type Captured = { url: string; title: string; text: string };

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

// What a message from the bookmark carries, as plain capped strings, or null
// when it isn't one. Anything can post a message to a window, so nothing here
// is trusted: it only fills in the form for Elle to check and save.
export function readCaptureMessage(data: unknown): Captured | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type !== CAPTURE_MESSAGE) return null;
  const url = clip(d.url, MAX_CAPTURE_URL).trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, title: clip(d.title, MAX_CAPTURE_TITLE).trim(), text: clip(d.text, MAX_CAPTURE_TEXT).trim() };
}

// The backup: what the bookmark copied ("link" on the first line, then the
// text) pasted into one box. Also accepts a link anywhere in pasted text.
export function splitPasted(pasted: string): { url: string; text: string } {
  const clean = pasted.slice(0, MAX_CAPTURE_URL + MAX_CAPTURE_TEXT).trim();
  const [first, ...rest] = clean.split(/\r?\n/);
  if (/^https?:\/\/\S+$/i.test(first?.trim() ?? "")) return { url: first.trim(), text: rest.join("\n").trim() };
  const found = clean.match(/https?:\/\/[^\s<>"]+/i);
  return { url: found?.[0] ?? "", text: found ? clean.replace(found[0], "").trim() : clean };
}

// Facebook and other sites put their name in the tab title ("(3) Photo Biz |
// Facebook"); a shorter title reads better in the queue.
export function tidyTitle(title: string): string {
  return title
    .replace(/^\(\d+\+?\)\s*/, "")
    .replace(/\s*[|\-–]\s*(Facebook|Reddit)$/i, "")
    .trim()
    .slice(0, MAX_CAPTURE_TITLE);
}
