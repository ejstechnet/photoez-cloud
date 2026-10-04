// The landing-page quiz (/quiz): four quick questions, then a personal
// result (tools replaced, rough yearly savings, the plan that fits). The
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

// The jobs PhotoEZ Cloud does, each with what it gives them. The result
// lists the ones their current tools don't cover, so it never claims
// another product lacks a particular feature.
export const FEATURES = [
  { id: "inquiries", label: "Inquiries answered for you", detail: "AI sorts every new inquiry and drafts a reply in your voice." },
  { id: "booking", label: "Online booking", detail: "Clients pick a real open time and pay the deposit, with text and email reminders." },
  { id: "paperwork", label: "Contracts and invoices", detail: "Contracts signed online, quotes and invoices, paid straight to your own Stripe." },
  { id: "galleries", label: "Proofing galleries", detail: "Clients favorite and select, you deliver finals in a click, and AI search finds any shot." },
  { id: "store", label: "A print and merch store", detail: "A store in every gallery, with a design studio and 3D preview." },
  { id: "marketing", label: "Help getting found", detail: "A free directory listing, reviews, client referrals, and gift cards." },
] as const;
type FeatureId = (typeof FEATURES)[number]["id"];

// What they use now, with a typical monthly price for the entry plan (billed
// yearly where that's how it's sold), in cents. Shown as "about". `covers`
// is which of the FEATURES jobs that tool already does.
export const TOOLS: readonly { id: string; label: string; cents: number; covers: readonly FeatureId[] }[] = [
  { id: "honeybook", label: "HoneyBook", cents: 2900, covers: ["inquiries", "booking", "paperwork"] },
  { id: "dubsado", label: "Dubsado", cents: 2800, covers: ["inquiries", "booking", "paperwork"] },
  { id: "studioninja", label: "Studio Ninja", cents: 1600, covers: ["inquiries", "booking", "paperwork"] },
  { id: "pixieset", label: "Pixieset", cents: 1600, covers: ["galleries", "store"] },
  { id: "shootproof", label: "ShootProof", cents: 800, covers: ["galleries", "store", "paperwork"] },
  { id: "pictime", label: "Pic-Time", cents: 700, covers: ["galleries", "store"] },
  { id: "scheduler", label: "Calendly or Acuity", cents: 1000, covers: ["booking"] },
  { id: "website", label: "A website builder (Squarespace, Wix, Showit)", cents: 1600, covers: [] },
  { id: "cloud", label: "Dropbox or Google Drive for delivery", cents: 1000, covers: [] },
  { id: "manual", label: "Spreadsheets, email, and texts", cents: 0, covers: [] },
];

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
  // Per year.
  savingsCents: number;
  // What PhotoEZ Cloud does that none of their current tools cover.
  missing: { id: string; label: string; detail: string }[];
  answer: string;
};

// The personal result: the plan that fits, what it replaces, and roughly
// what they'd save in a year. The tools' prices are billed yearly where
// offered, so they're compared with the plan's yearly price (two months free).
export function quizResult(a: QuizAnswers): QuizResult {
  const busy = a.volume === "20+" || (a.volume === "11-20" && (a.shoots.includes("weddings") || a.shoots.includes("events")));
  const plan = busy ? "studio" : "pro";
  const planCents = PLAN_PRICES[plan].month;
  const replaced = TOOLS.filter((t) => a.tools.includes(t.id) && t.id !== "manual").map(({ id, label, cents }) => ({ id, label, cents }));
  const covered = new Set(TOOLS.filter((t) => a.tools.includes(t.id)).flatMap((t) => t.covers));
  // Only once they've said what they use; otherwise there's nothing to compare.
  const missing = a.tools.length ? FEATURES.filter((f) => !covered.has(f.id)).map((f) => ({ ...f })) : [];
  const currentCents = replaced.reduce((sum, t) => sum + t.cents, 0);
  const headache = HEADACHES.find((h) => h.id === a.headache);
  return {
    plan,
    planCents,
    replaced,
    currentCents,
    savingsCents: Math.max(0, currentCents * 12 - PLAN_PRICES[plan].year),
    missing,
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
