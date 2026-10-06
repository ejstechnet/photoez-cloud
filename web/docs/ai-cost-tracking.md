# AI cost tracking

Every Claude call PhotoEZ Cloud makes is recorded in `ai_usage`, with its tokens and what it cost. The owner-only report at **Settings → AI usage** (`/dashboard/ai-usage`) turns those rows into monthly totals.

## What's recorded

| Feature | Model | One row per | Counts toward plan limit |
|---|---|---|---|
| `triage` | Claude Opus 5 (the API may answer with its fallback model) | triage call, including re-runs | never |
| `assistant` | Claude Sonnet 5 | Assistant question; its model calls are added up, the same way as its trace | yes |
| `photo_tag` | Claude Haiku 4.5 | photo | yes once described; a failed call is recorded but doesn't count |
| `eval` | Opus 5 (triage) and Sonnet 5 (judge) | eval call, with no studio | never |

Each row keeps:
- **Tokens** in the four billed kinds: uncached input, cache writes, cache reads, output. `input_tokens` is all three input kinds added together, as it always was.
- **Cost** in microdollars (millionths of a dollar), plus which price was used (`price_key`).
- **Latency.**
- **Links** to the inquiry, trace or gallery.

Every feature records through one helper, `recordAiUsage()` in `lib/ai/usage.ts`, right after the API answers. That includes answers that come back refused or cut off, because those calls are billed too. The helper never throws: if a row can't be written, the error is logged and the feature carries on.

Plan limits count a studio's rows for one feature where `counts_toward_limit` is true, in the studio's own month. That's exactly the rows they counted before cost tracking.

## Prices

`lib/ai/prices.ts` lists each model's price per million tokens: input, 5-minute cache write, cache read and output. A dollar per million tokens is one microdollar per token, so:

```
cost = uncached × input + cache writes × write + cache reads × read + output × output
```

It's rounded once, at the end.

Each price has an `effectiveFrom` date. **To change a price, add a new entry; don't edit the old one.** Calls keep the price that was in effect when they were made. Dated model ids (`claude-haiku-4-5-20251001`) use their model's price. A model with no price still has its tokens recorded, with no cost, and the report flags it.

## The report

The report covers one month, Pacific time. It shows:
- **Totals:** total spend, by feature, by model and by day.
- **Unit costs:** average and highest per triaged inquiry, per Assistant question and per described photo.
- **By studio:** a sortable per-studio table with a CSV download. "List price" is the plan's price while a subscription is being paid, with yearly plans divided by 12. Coupons, referral credit and extra storage aren't included.
- **Caching:** the Assistant's spend with and without prompt caching.
- **Data quality:** how many rows are estimates and how many have no price.

The math is `summarizeUsage()` in `lib/ai/cost-report.ts`.

## Estimates and the backfill

Rows recorded before cost tracking have `token_split_known = false`, because cached and uncached input were added together then. Their cost prices every input token at the full rate, which is an upper bound, and the report labels them.

To fill in costs for old rows, and add a triage row for each inquiry triaged before this change, run this from `web/`:

```
npm run ai:backfill
```

It's safe to run more than once. An inquiry that was triaged several times only kept its last run's tokens, so its backfilled cost is low.

## Evals

Eval runs record `eval` rows in whichever database `web/.env` points at. When the evals run on a developer's computer, that's the local database. `npm run eval:triage` loads `scripts/register.mjs`, so the eval scripts can use the app's recording code.

## Tests

`npm test` covers this in three files, all without calling the Anthropic API:

- `lib/ai/prices.test.ts`: cost math for each model, price changes, an unknown model.
- `lib/ai/usage.test.ts`:
  - triage, Assistant and tagging rows
  - a failed write never breaks a feature
  - plan limits count exactly as before
  - the backfill can be repeated safely
- `lib/ai/cost-report.test.ts`: report totals, list prices, Pacific-time months, the owner check.
