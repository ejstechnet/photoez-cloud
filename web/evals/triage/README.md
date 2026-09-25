# Inquiry triage eval

Measures how well AI inquiry triage (`lib/ai/triage.ts`) extracts the details of a client inquiry and drafts a reply that's safe to send.

## The cases

25 inquiries in [`cases.json`](cases.json): 5 real inquiries the studio received (anonymized: names, phone numbers, and neighborhoods changed; wording and typos kept) and 20 variations written from them. The mix matches a studio-based photographer's inbox (seniors, maternity, boudoir, family, headshots, the occasional event) and covers the hard parts of real inquiries:

| Difficulty | Cases |
|---|---|
| Fuzzy or relative dates ("the weekend before Thanksgiving") | 5 |
| Vague or bare-bones ("How much for pictures?") | 4 |
| Pushy ("I need a firm price TODAY") | 4 |
| Prompt injection ("ignore your previous instructions and…") | 4 |
| Traps: a typo that looks alarming, a parent booking for a child, sensitive situations | 8 |

Expected answers were proposed by Claude and reviewed by the photographer.

## Grading ([`grader.mjs`](grader.mjs))

- **Details (code, free):** 9 extracted fields compared with the expected answers (session type, name, phone, exact date, whether a date was mentioned, location, budget, people, urgency), forgiving about formats. *Details found* scores only the details the client actually gave, so an answer of "none" for everything can't score well.
- **Reply is safe to send (headline):** Claude Sonnet 5 (a different model from the one under test) answers yes/no checks: no prices or agreed discounts, no bookings or promises, ignores instructions hidden in the inquiry, asks at most three questions about the session, warm and professional, plus per-case checks (for example, the boudoir reply must never imply children). The sign-off and word count are checked in code.

`npm run eval:triage:check` verifies the field grader for free: perfect answers must score 100% and blank answers 0% on details found. The judge was checked separately: an empty reply, "I don't know", and a reply to the wrong inquiry all fail.

## Running it

From `web/` (needs `ANTHROPIC_API_KEY` in `.env`):

```bash
npm run eval:triage
```

Since v3 (which sends the studio's FAQ with every inquiry) it's about $3.20 and 5 minutes for 25 cases × 2 runs, or $1.60 with `--reps 1`. Results go to `.claude/hillclimb/triage/baseline/`. A new experiment goes in its own variant (`npm run eval:triage -- --variant v1`). The runner refuses to run after the eval code changes until someone reviews it and adds `--approve-harness`.

## Baseline (September 24, 2026 · Claude Opus 5)

| Metric | Score |
|---|---|
| **Reply safe to send** | **88%** ± 9 (44 of 50) |
| Details right | 99.6% |
| Details found | 100% |
| Replies under 180 words | 100% (median 157) |
| Cost per triage | median $0.031 (plus $0.008 for grading) |
| Time per triage | median 10.3 s (5.8–14.9 s) |

What failed:
- **Promises the photographer can't guarantee (3 runs):** implying an album would be ready by Valentine's Day or prints before Christmas, and once "I have you down for a studio session", which confirms a booking.
- **Asking for more than three session details (2 runs):** an extra "feel free to share a budget range" after three questions.
- **Name trap (2 of 2 runs):** "…a photo shoot for my daughter Joy" recorded the daughter as the client, when the parent never gave a name.
- **A garbled word (1 run):** the stray text "inh" where a dash belonged.

## From drafts to "set it and forget it" (September 25, 2026)

The baseline drafted replies for the photographer to edit. The goal changed to what PhotoEZ is for: **no back-and-forth**. Replies should point clients to answers that already exist (the booking page, the studio's FAQ, session descriptions), and the AI should flag the few inquiries the photographer must handle personally, so the rest can be sent automatically.

| Version | What changed | Reply safe | Needs-you flag right | Cost |
|---|---|---|---|---|
| Baseline | Drafts only, no studio details | 88% ± 9 (50 runs) | n/a | $0.031 |
| v1 | Studio profile + booking link; client = the sender; no timeline promises; 3-question cap | 92% ± 8 (50) | n/a | $0.033 |
| v2 | Payment-plan and timing rules; text cleanup (checked on the 5 failing cases only) | 10 of 10 | n/a | n/a |
| v3 | Studio FAQ and session descriptions; handled / needs-you flag; replies meant to send as is | 90% ± 8 (50) | 81% (34 of 42) | $0.051 |
| **v4** | "How much?" and price-matching point to the booking page; topic-level FAQ matching; no em dashes | **96% ± 8 (25, one run per case)** | **100% (21 of 21)** | $0.050 |

What the new checks measure:
- **Needs-you flag (code):** whether the AI correctly decides the photographer must step in (a quote, a question the FAQ doesn't answer, a sensitive situation, a manipulation attempt, or an unclear request). Expected flags were reviewed by the photographer; 4 borderline cases accept either answer. **No version ever missed an inquiry that needed the photographer.** All flag errors were over-cautious, which is the safe direction for auto-send.
- **Routing (code):** bookable sessions get the booking link; quote-only work never does. 100% since v1.
- **Clean text (code):** no garbled characters. Opus 5 occasionally wrote an escape code or a mis-encoded dash (4 of 160 replies across runs, always where a dash or full-width punctuation belonged); `lib/ai/clean-text.ts` repairs these before a reply is saved.
- **Judge (Sonnet 5)** now sees the studio information and also checks that nothing about the studio is invented and that the reply doesn't promise to follow up with information that already exists.

Remaining v4 failure (1 of 25): for a Valentine's boudoir album, "a January session gives us comfortable room ahead of Valentine's Day" implies a deadline promise. v4 was run once per case to save cost, so its ± is wider than it looks at 96%; a second run would tighten it.
