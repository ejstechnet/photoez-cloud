// The landing-page quiz (/quiz): four quick questions, then a personal
// result (tools replaced, rough monthly savings, the plan that fits). The
// answers ride along in a cookie and are saved with the new studio's sign-up
// (lib/auth.ts), so Settings > Sign-ups shows what people shoot and use.
import { PLAN_PRICES } from "./plans.ts";

export const SHOOTS = [
  { id: "weddings", label: "Weddings & elopements" },
  { id: "portraits", label: "Portraits & families" },
  { id: "seniors", label: "Seniors & graduates" },
  { id: "newborn", label: "Newborns & kids" },
  { id: "events", label: "Events & sports" },
  { id: "brand", label: "Business & brand" },
  { id: "other", label: "Something else" },
] as const;

// What they use now, with a typical monthly price for the entry plan (billed
// yearly where that's how it's sold), in cents. Shown as "about".
export const TOOLS = [
  { id: "honeybook", label: "HoneyBook", cents: 2900 },
  { id: "dubsado", label: "Dubsado", cents: 2800 },
  { id: "studioninja", label: "Studio Ninja", cents: 1600 },
  { id: "pixieset", label: "Pixieset", cents: 1600 },
  { id: "shootproof", label: "ShootProof", cents: 800 },
  { id: "pictime", label: "Pic-Time", cents: 700 },
  { id: "scheduler", label: "Calendly or Acuity", cents: 1000 },
  { id: "website", label: "A website builder (Squarespace, Wix, Showit)", cents: 1600 },
  { id: "cloud", label: "Dropbox or Google Drive for delivery", cents: 1000 },
  { id: "manual", label: "Spreadsheets, email, and texts", cents: 0 },
] as const;

export const HEADACHES = [
  {
    id: "inquiries",
    label: "Keeping up with inquiries",
    answer: "AI sorts every new inquiry (session type, date, budget) and drafts a reply in your voice for you to send.",
  },
  {
    id: "booking",
    label: "Booking and scheduling",
    answer: "Clients pick a real open time, answer your questions, sign, and pay the deposit, all in one go.",
  },
  {
    id: "paperwork",
    label: "Contracts and getting paid",
    answer: "Contracts fill in from each booking and are signed online; deposits and balances go straight to your own Stripe.",
  },
  {
    id: "delivery",
    label: "Proofing and delivering galleries",
    answer: "Clients favorite and select in one gallery, you deliver finals with a click, and AI search finds any shot in seconds.",
  },
  {
    id: "selling",
    label: "Selling prints and products",
    answer: "Every gallery has a print and merch store, with a design studio and 3D preview; you set the prices.",
  },
  {
    id: "marketing",
    label: "Getting found and booking new clients",
    answer: "A free listing in the photographer directory, client referrals, gift cards, and reviews on your studio page.",
  },
] as const;

export const VOLUMES = [
  { id: "1-4", label: "1–4 sessions" },
  { id: "5-10", label: "5–10 sessions" },
  { id: "11-20", label: "11–20 sessions" },
  { id: "20+", label: "More than 20" },
] as const;

export type QuizAnswers = {
  shoots: string[];
  tools: string[];
  headache: string;
  volume: string;
};

const ids = <T extends readonly { id: string }[]>(list: T) => new Set(list.map((x) => x.id));
const SHOOT_IDS = ids(SHOOTS);
const TOOL_IDS = ids(TOOLS);
const HEADACHE_IDS = ids(HEADACHES);
const VOLUME_IDS = ids(VOLUMES);

// Only known answers survive (the cookie comes back from the browser).
export function cleanAnswers(raw: unknown): QuizAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const list = (v: unknown, known: Set<string>) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && known.has(x)))] : [];
  const one = (v: unknown, known: Set<string>) => (typeof v === "string" && known.has(v) ? v : "");
  const answers = {
    shoots: list(r.shoots, SHOOT_IDS),
    tools: list(r.tools, TOOL_IDS),
    headache: one(r.headache, HEADACHE_IDS),
    volume: one(r.volume, VOLUME_IDS),
  };
  return answers.shoots.length || answers.tools.length || answers.headache || answers.volume ? answers : null;
}

// Compact cookie value: "s=weddings.portraits|t=honeybook|h=booking|v=5-10".
export function encodeAnswers(a: QuizAnswers): string {
  return [`s=${a.shoots.join(".")}`, `t=${a.tools.join(".")}`, `h=${a.headache}`, `v=${a.volume}`].join("|");
}

export function decodeAnswers(value: string | null | undefined): QuizAnswers | null {
  if (!value) return null;
  const parts = Object.fromEntries(
    value
      .split("|")
      .map((p) => p.split("="))
      .filter((p) => p.length === 2),
  );
  return cleanAnswers({
    shoots: (parts.s ?? "").split(".").filter(Boolean),
    tools: (parts.t ?? "").split(".").filter(Boolean),
    headache: parts.h ?? "",
    volume: parts.v ?? "",
  });
}

export const QUIZ_COOKIE = "pez_quiz";

export function answersFromCookieHeader(cookieHeader: string | null | undefined): QuizAnswers | null {
  const match = new RegExp(`(?:^|;\\s*)${QUIZ_COOKIE}=([^;]*)`).exec(cookieHeader ?? "");
  if (!match) return null;
  try {
    return decodeAnswers(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export type QuizResult = {
  plan: "pro" | "studio";
  planCents: number;
  replaced: { id: string; label: string; cents: number }[];
  currentCents: number;
  savingsCents: number;
  answer: string;
};

// The personal result: the plan that fits, what it replaces, and roughly
// what they'd save each month.
export function quizResult(a: QuizAnswers): QuizResult {
  const busy = a.volume === "20+" || (a.volume === "11-20" && (a.shoots.includes("weddings") || a.shoots.includes("events")));
  const plan = busy ? "studio" : "pro";
  const planCents = PLAN_PRICES[plan].month;
  const replaced = TOOLS.filter((t) => a.tools.includes(t.id) && t.id !== "manual").map((t) => ({ ...t }));
  const currentCents = replaced.reduce((sum, t) => sum + t.cents, 0);
  const headache = HEADACHES.find((h) => h.id === a.headache);
  return {
    plan,
    planCents,
    replaced,
    currentCents,
    savingsCents: Math.max(0, currentCents - planCents),
    answer: headache?.answer ?? HEADACHES[1].answer,
  };
}

// Readable answers, e.g. for the Sign-ups page.
export function describeAnswers(a: QuizAnswers): string {
  const label = <T extends readonly { id: string; label: string }[]>(list: T, id: string) => list.find((x) => x.id === id)?.label ?? id;
  const parts = [
    a.shoots.length ? `Shoots: ${a.shoots.map((s) => label(SHOOTS, s)).join(", ")}` : "",
    a.tools.length ? `Uses: ${a.tools.map((t) => label(TOOLS, t)).join(", ")}` : "",
    a.headache ? `Headache: ${label(HEADACHES, a.headache)}` : "",
    a.volume ? `${label(VOLUMES, a.volume)} a month` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}
