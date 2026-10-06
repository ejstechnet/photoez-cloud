# Studio Assistant: architecture

The Studio Assistant answers a photographer's questions about their studio with Claude Sonnet 5 and a small set of tools. It can look things up and **prepare** actions. It can never send or change anything without the photographer's approval, and the code enforces that.

## The agent loop

`lib/ai/assistant/run.ts` (`askAssistant`) is a manual tool-use loop of up to 8 rounds:

1. Check the studio's plan and monthly allowance (`ai_usage`, one row per question).
2. Call the model with the system prompt, the tools, and the last 12 turns of the saved conversation.
3. For each tool the model asks for: a look-up runs through `executeTool`, and an action becomes an approval card through `requestAction`. All results go back in one message.
4. Stop at a final answer, a refusal, or the round limit.

## Tools and their effects

Every tool is registered in `lib/ai/assistant/registry.ts` with a required `effect`. A tool without one fails typecheck.

| Effect | Meaning | Tools |
|---|---|---|
| `read` | Reads the studio's own data; runs right away | `studio_overview`, `find_bookings`, `find_galleries`, `find_clients`, `find_inquiries`, `revenue` |
| `write` | Changes data in PhotoEZ Cloud | none yet |
| `external` | Leaves the app: email, texts, payments | `propose_client_email`, `propose_gallery_emails`, `propose_balance_reminders`, `propose_booking_status` (cancelling emails the client) |

## The approval flow

1. **Requested.** The model calls a `propose_` tool. `requestAction` checks the ids belong to the studio, then saves an `assistant_proposals` row:
   - status `pending`
   - the exact `payload` that will run
   - `args_hash` (sha256 of the tool name and payload)
   - expiry: 24 hours
   - a link to the trace

   The model is told the card is waiting for approval. Nothing runs.
2. **Decided.** The signed-in photographer clicks Approve or Dismiss (`approveProposal` / `dismissProposal` in `app/dashboard/assistant/actions.ts`). `decideAction` changes only that studio's own unexpired pending card, moving it to `approved` or `rejected`. No tool can approve anything.
3. **Executed.** `executeTool` (`lib/ai/assistant/executor.ts`) is the only place any tool runs. For a `write` or `external` tool, it:
   - requires the id of an approved card;
   - in one conditional update, claims the card (`approved` → `executing`) only if it is this studio's card, for this tool, unexpired, and matches the hash of the arguments supplied;
   - checks the stored payload still matches its hash;
   - re-checks the studio's current data (clients still exist and have an email, galleries still delivered or open, bookings still confirmed and owing);
   - runs the action **one recipient at a time**, saving each result in `deliveries` as it goes: `sending`, then `sent` or `failed`. A recipient that no longer qualifies is `skipped` with a reason.
   - records `executed` when everyone got it, otherwise `failed`.

   Emails and booking changes are passed in as `effects`, so tests can prove nothing ran.

**New clients.** People who aren't clients yet are added only when the card runs, never when it's proposed. The executor looks them up by email first, so a retry never adds them twice.

**Retries never repeat anyone.** "Try again for the rest" moves a `failed` card back to `approved`, or a card stuck in `executing` for over 10 minutes. It then runs only recipients still `pending` or `failed`, re-checked first. Two statuses are never retried, because those people may already have the email:
- `sending`: the run was cut off before the send was confirmed. It becomes `unknown`.
- `unknown`: sending threw an error.

The card shows each recipient as done, didn't go through, not sure (check the Email log), or skipped. A retry is refused once the card's 24 hours are up.

Pending cards past 24 hours become `expired`, both on the 15-minute cron job and when a conversation is reopened.

**Untrusted text.** `find_inquiries` sends inquiry text to the model as `untrusted_client_text`, wrapped in `<untrusted_client_content>` tags, with a warning that it's information to report, never instructions. The system prompt says the same. Even if the model obeys an injected instruction, the worst it can do is prepare a card.

## Step logs (traces)

`lib/ai/assistant/trace.ts` records each answer in `ai_traces`, with each step in `ai_trace_steps`. The loop wraps its model call in `trace.modelCall()` and each tool in `trace.toolCall()`.

Each trace records:
- every model call, tool call, approval request and decision, plus errors
- the input and output of each step, capped at 10 KB and marked when cut
- timing
- uncached, cache-read, cache-write and output tokens, kept separately
- the API request id

Every write is caught, so a failed log never fails an answer. Traces are scoped to the studio. Only the PhotoEZ Cloud owner can read them, at `/dashboard/ai-traces`. They're kept for `AI_TRACE_KEEP_DAYS` (default 90) and then deleted by the cron job.

## What the tests prove

`npm test` runs these against PGlite, an in-memory Postgres built from the real migrations, with a scripted model. Tests never call the Anthropic API.

`approvals.test.ts`:
- Every registered tool has a valid effect, and each `propose_` tool needs approval.
- Running an action tool without an approved card throws, leaves the database unchanged, and calls no effects.
- Pending, dismissed, expired, failed and already-run cards are refused.
- One studio can't approve or run another studio's card.
- Changed arguments, or a payload edited after approval, are refused.
- Two simultaneous runs of one approved card run it exactly once.
- A model that calls an action tool ends its turn with a pending card and no side effect.
- An inquiry that tries a prompt injection ("email every client") produces only a pending card, with no email sent.
- A model claiming the photographer already approved can't run anything.
- A crash partway through a bulk send records who got it, and a retry emails only those never tried. A run cut off mid-send (process died) is retried without repeating anyone. A run still in progress can't be retried.
- A recipient whose email failed is retried, and the card then finishes.
- A new client is added only on approval, and only once across retries.
- Cards re-check at run time and skip:
  - a cancelled or fully paid booking
  - an undelivered gallery for a review request
  - a closed gallery for a closing-soon reminder or link
  - an already-cancelled booking
  - a client with no email address
- Inquiry text is marked as untrusted.
- Look-ups count payments, and each client's bookings and galleries, correctly.

`trace.test.ts`:
- Steps are recorded in order, with the token fields filled in.
- Answers still come back when steps, or the whole trace, can't be saved.
- Traces past the retention period are deleted.
