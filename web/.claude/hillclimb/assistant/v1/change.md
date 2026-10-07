Fixes from the baseline: studio name, Time off look-up, no offers it can't keep, cards only once made, cancelled bookings owe nothing.

What changed (lib/ai/assistant):
- run.ts: the first line of each question now carries the studio's name, and the prompt says to sign drafts with it (baseline: drafts signed "The Studio", 2 of 2).
- registry.ts + tools.ts: a new read-only find_time_off tool lists the photographer's Time off (baseline: couldn't see it, once claimed the app has none).
- run.ts prompt: lists what the Assistant can and can't do, and says to point to the dashboard for the rest (baseline: "I can add her email", 2 of 2).
- run.ts prompt: say a card is ready only after a propose_ tool prepared it this turn (baseline: once claimed a cancellation card that didn't exist).
- run.ts prompt: technical advice should stay on the question and be accurate; a few correct points over a long list (baseline: wrong autofocus advice, 2 of 2).
- tools.ts: find_bookings reports $0 due on a cancelled booking (found by the free grader check).

Eval change: the blackout-nov case now also accepts the actual Time off dates (Nov 26-27) when the Assistant can look them up, and the fact sheet no longer says the Assistant has no Time off tool. Both baseline answers fail under the new wording too, so the comparison is unaffected.

Afterwards (kept for production): Time off look-up, studio name, cancelled-booking fix, accuracy line. Undone: the card-readiness rule ("prepare it or offer to" caused over-asking) and the can't-do list ("say where in the dashboard" caused guessed locations).
