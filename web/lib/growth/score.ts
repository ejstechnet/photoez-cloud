// Turning the AI's answer into a score Elle can trust, and its draft into a
// reply that follows the community's rules. No database or API here, so it's
// tested on its own (score.test.ts).
//
// The AI gives points for four criteria, each with a quote from the post.
// Code then checks every quote really is in the post (no quote, no points),
// caps each criterion at its maximum, works out recency itself from the
// post's date, and adds it all up. The model never does the arithmetic.
import { GROWTH_CRITERIA, type GrowthCriteria, type GrowthCriterionKey } from "./constants";

export type ModelCriterion = { points: number; evidence: string };
export type ModelCriteria = Record<Exclude<GrowthCriterionKey, "recency">, ModelCriterion>;

const MAX = Object.fromEntries(GROWTH_CRITERIA.map((c) => [c.key, c.max])) as Record<GrowthCriterionKey, number>;

// Lowercase, straight quotes, one space: so a quote still matches when the
// AI changes curly quotes or line breaks.
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Whether a quote really appears in the post (ignoring surrounding quote
// marks and trailing "…").
export function quoteInPost(quote: string, post: string): boolean {
  const q = normalize(quote)
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/(\.\.\.|…)$/, "")
    .trim();
  return q.length >= 3 && normalize(post).includes(q);
}

// Recency from the post's date: the spec's 15 points for this week, fading
// over a month. Unknown date: half marks, said plainly.
export function recencyFor(publishedAt: Date | null, now = new Date()): { points: number; evidence: string } {
  if (!publishedAt) return { points: 8, evidence: "Post date unknown (half marks)" };
  const days = Math.max(0, Math.floor((now.getTime() - publishedAt.getTime()) / 86_400_000));
  const when = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  const points = days <= 2 ? 15 : days <= 7 ? 12 : days <= 14 ? 8 : days <= 30 ? 4 : 0;
  return { points, evidence: `Posted ${when}` };
}

// The checked criteria and their total (0–100).
export function scoreCriteria(model: ModelCriteria, post: string, publishedAt: Date | null, now = new Date()): { criteria: GrowthCriteria; total: number } {
  const criteria = {} as GrowthCriteria;
  for (const { key, max } of GROWTH_CRITERIA) {
    if (key === "recency") {
      criteria.recency = { ...recencyFor(publishedAt, now), max };
      continue;
    }
    const given = model[key];
    const points = Math.max(0, Math.min(MAX[key], Math.round(Number(given?.points) || 0)));
    const evidence = (given?.evidence ?? "").trim();
    criteria[key] = quoteInPost(evidence, post)
      ? { points, max, evidence }
      : // No quote from the post, no points: intent can't be made up.
        { points: 0, max, evidence: evidence ? `Quote not found in the post: "${evidence}"` : "No quote given" };
  }
  const total = GROWTH_CRITERIA.reduce((sum, c) => sum + criteria[c.key].points, 0);
  return { criteria, total };
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s)>\]]+|\bphotoezcloud\.com\S*/gi;

// Makes a drafted reply follow the community's rules no matter what the AI
// wrote: no links where links aren't allowed (the product is named instead),
// and the disclosure whenever PhotoEZ is mentioned.
export function enforceReplyRules(draft: string, rules: { linksAllowed: boolean; disclosure: string }): string {
  let text = draft.trim();
  if (!rules.linksAllowed) {
    text = text
      .replace(URL_PATTERN, (match) => (/photoez/i.test(match) ? "PhotoEZ Cloud" : ""))
      .replace(/[ \t]+([.,!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\(\s*\)/g, "")
      .trim();
  }
  const mentions = /photoez/i.test(text);
  const disclosed =
    normalize(text).includes(normalize(rules.disclosure)) || /\bI (make|built|created|run|own|founded|developed)\b[^.]{0,40}photoez/i.test(text);
  if (mentions && !disclosed) text = `${text}\n\n${rules.disclosure}`;
  return text;
}
