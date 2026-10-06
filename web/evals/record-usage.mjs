// Eval runs go in the AI cost report too: each call is an ai_usage row with
// feature "eval", no studio, and never counted toward a plan. They land in
// whichever database web/.env points at (Elle's local one when she runs
// evals). Needs the script loader for app imports:
//   node --env-file=.env --import ./scripts/register.mjs evals/...
// Without it (or without DATABASE_URL), nothing is recorded and the eval
// carries on.
export async function recordEvalUsage(model, usage, latencyMs = null) {
  if (!process.env.DATABASE_URL || !model || !usage) return;
  try {
    const { recordAiUsage } = await import("../lib/ai/usage.ts");
    const { tokensFromApi } = await import("../lib/ai/prices.ts");
    await recordAiUsage({ feature: "eval", photographerId: null, model, tokens: tokensFromApi(usage), latencyMs, countsTowardLimit: false });
  } catch (e) {
    console.error(`Couldn't record eval usage: ${e?.message ?? e}`);
  }
}
