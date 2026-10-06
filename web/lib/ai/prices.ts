// What each Claude model costs, for the AI cost report (lib/ai/usage.ts).
// Dollars per million tokens, from Anthropic's pricing page
// (platform.claude.com/docs/en/about-claude/pricing), confirmed with Elle on
// 2026-10-05. Cache writes are the 5-minute kind the app uses.
//
// A price change adds a new entry with a later effectiveFrom, so calls made
// before it keep their old cost. The first entry for a model covers every
// earlier call. A dollar per million tokens is exactly one microdollar per
// token, which is what the math below relies on.

export type ModelPrice = {
  model: string;
  // YYYY-MM-DD (UTC): calls on or after this day use this price.
  effectiveFrom: string;
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
};

export const MODEL_PRICES: ModelPrice[] = [
  // Inquiry triage.
  { model: "claude-opus-5", effectiveFrom: "2025-01-01", input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  // Studio Assistant, and the triage eval's judge.
  { model: "claude-sonnet-5", effectiveFrom: "2025-01-01", input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
  // Photo tagging.
  { model: "claude-haiku-4-5", effectiveFrom: "2025-01-01", input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 },
];

// Tokens by kind. `input` is uncached input only.
export type TokenCounts = { input: number; cacheWrite: number; cacheRead: number; output: number };

// "claude-haiku-4-5-20251001" → "claude-haiku-4-5": the API reports dated ids.
export const modelFamily = (model: string) => model.trim().toLowerCase().replace(/-\d{8}$/, "");

// The price in effect for a model at a moment, or null when there's none.
export function priceFor(model: string, at: Date, prices: ModelPrice[] = MODEL_PRICES): ModelPrice | null {
  const family = modelFamily(model);
  const day = at.toISOString().slice(0, 10);
  const entries = prices.filter((p) => p.model === family).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  if (!entries.length) return null;
  // The latest entry already in effect; the first entry covers anything older.
  return entries.filter((p) => p.effectiveFrom <= day).at(-1) ?? entries[0];
}

export const priceKey = (p: ModelPrice) => `${p.model}@${p.effectiveFrom}`;

// Cost in microdollars (millionths of a dollar), rounded once at the end.
export function costMicrodollars(tokens: TokenCounts, price: ModelPrice): number {
  return Math.round(
    tokens.input * price.input + tokens.cacheWrite * price.cacheWrite + tokens.cacheRead * price.cacheRead + tokens.output * price.output,
  );
}

// What the same tokens would have cost with no caching (every input token at
// the full input price): for the report's cache-savings line.
export function uncachedCostMicrodollars(tokens: TokenCounts, price: ModelPrice): number {
  return Math.round((tokens.input + tokens.cacheWrite + tokens.cacheRead) * price.input + tokens.output * price.output);
}

// One API call's usage, as the features hand it to recordAiUsage.
export type CallUsage = { model: string; tokens: TokenCounts; latencyMs: number | null };

// The usage block of an API response, split the way it's billed.
export function tokensFromApi(u: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): TokenCounts {
  return { input: u.input_tokens, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, output: u.output_tokens };
}
