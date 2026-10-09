# Photo-tagging eval

Measures AI photo tagging for gallery search (`lib/ai/photo-tags.ts`, Claude Haiku 4.5) by what clients experience. It asks two questions about each search a client might type: does it find the right photo, and does it stay away from the wrong one?

## The cases

The photographer's own photos (graduation, maternity, studio portraits, family), each with searches she wrote in [`searches.csv`](searches.csv):
- **should_find:** what a client might type to find this photo.
- **should_not_find:** believable things that aren't in it, to catch made-up tags. `man` on photos of women tests the search itself.

The photos stay on her computer: `photos/` is gitignored, because the repo is public. They're sent to Anthropic for tagging, exactly as the app does with real galleries.

A few rows were kept from a ChatGPT draft (its text is in `photos/searches-chatgpt-backup.csv`). The runner tags each row `elle`, `chatgpt` or `mixed`, and **the headline is the photographer's own rows (`elle`, 27 photos)**.

## Grading ([`grader.mjs`](grader.mjs)), free

Each photo is shrunk the way the app does it (900px thumbnail, then 512px) and tagged by the real `tagPhoto()`. Then the app's real gallery search (`lib/photo-search.ts`) runs every phrase against a practice gallery holding just that photo, in an in-memory Postgres.

| Score | Passes when |
|---|---|
| **No wrong match** (headline) | None of the "should not find" searches turns the photo up |
| All found | Every "should find" search turns it up |
| Find rate | Share of "should find" searches that turn it up |
| Wrong rate | Share of "should not find" searches that wrongly turn it up |

The grader was calibrated with the photographer on a 12-photo pilot, where she confirmed which disagreements were the AI's mistakes and which were hers.

`npm run eval:photo-tags:check` checks the grader for free:
- Tags equal to the "should find" searches pass every row.
- Empty tags fail every search.
- Tags that include the "should not find" phrases are caught.

## Running it

From `web/` (needs `ANTHROPIC_API_KEY` in `.env`, and the photos in `photos/`):

```bash
npm run eval:photo-tags
```

35 photos × 2 runs costs about **$0.09** and takes **45 seconds**. The runner refuses to run after the eval code or `searches.csv` changes, until someone reviews the change and adds `--approve-harness`.

## Results (October 9, 2026 · Claude Haiku 4.5)

The photographer's 27 photos, 2 runs each:

| Score | Baseline | v1 |
|---|---|---|
| **No wrong match** | **70%** | **93%** |
| Wrong rate | 9% | 1% |
| Find rate | 32% | 39% |
| All found | 0% | 0% |
| Tags per photo | 14.5 | 16.6 |
| Cost per run (35 photos × 2) | $0.086 | $0.099 |

**Baseline:**
- **Wrong matches were mostly the search, not the AI.**
  - `man` found photos of a pregnant woman (12 times), because the search matched letters inside other words; "son" found "per**son**" the same way.
  - `white background` found a photo tagged "white bodysuit" and "beige background", because the words came from different tags.
- **Misses were mostly vocabulary.** Clients type "girl", "sitting", "standing", "floor" and "smiling", and clothing and background colors. The AI said "graduate", "seated" and "backdrop", or left those things out.

**v1** ([`change.md`](../../.claude/hillclimb/photo-tags/v1/change.md)):
- The search matches whole words, with phrases kept together within one tag or the description.
- The tagger uses everyday words, and adds pose, clothing color, background color and readable text.
- Wrong matches fell from 9% to 1%. The three that remain are all single runs:
  - `gown` on a photo with no gown
  - `parents` on a photo of a graduate with her dog
  - `smile` on a photo where she isn't smiling

**Still missed:**
- **"girl"** (24 times). For grads the AI says "woman" or "graduate", which is arguably right for adults.
- **"graduation cap"** (15 times). The tags say "cap and gown" and "teal cap". The old search found it by combining words from different tags, which is the same behavior that caused the "white background" false match. This is v1's one trade-off.
- **"blue dress"** (11 times). The AI says "blue gown".

"All found" stays at 0%, because most rows list 5 to 9 searches, including fine details.

Tagging varies between runs: 19 of 35 photos got different tags on the two baseline runs, which is why each photo runs twice.
