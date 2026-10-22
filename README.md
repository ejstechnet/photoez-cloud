<p align="center">
  <img src="web/public/brand/photoez-cloud-logo.webp" alt="PhotoEZ Cloud" width="280">
</p>

# PhotoEZ Cloud

**AI-assisted studio software for photographers, live at [photoezcloud.com](https://photoezcloud.com).** Booking, proofing galleries, contracts, invoices and payments in one place, with AI that does the busywork: sorting inquiries and drafting replies, finding the right shots, flagging the ones to cut, and answering questions about the studio.

PhotoEZ Cloud is the SaaS successor to the [PhotoEZ](https://ejstech.net) WordPress plugin suite, which I built and sell through EJS Tech. The plugins give photographers galleries, booking, contracts, and invoicing on their own sites. This project rebuilds the whole workflow as a hosted app and puts AI features at the center.

> **Live at [photoezcloud.com](https://photoezcloud.com).** Photographers can sign up, take real payments through Stripe, and deliver galleries today; it runs on a VPS with zero-downtime deploys and nightly off-site backups. Free plan, and a 14-day Pro trial with no card.

## AI features

Each one has an eval built from real studio work, run before any change to the prompt or model ships. The evals live in [`web/evals`](web/evals).

| Feature | What it does | How it works | Measured |
|---|---|---|---|
| **Inquiry triage** | Reads a new inquiry, pulls out the session type, date, budget and questions, flags what needs the photographer, and drafts a reply | Claude with structured outputs; replies point to the booking page and FAQ instead of quoting prices | Reply safe to send: **88% → 96%**; never missed an inquiry that needed the photographer ([eval](web/evals/triage/README.md)) |
| **Gallery search** | Finds photos from plain words like "first dance" or "girl in a blue dress" | Claude Haiku tags each photo with everyday words; whole-word, phrase-aware Postgres search | No wrong matches: **70% → 93%** ([eval](web/evals/photo-tags/README.md)) |
| **Culling help** | Flags blurry frames, too dark/bright, missed flash, closed eyes, and near-duplicates before the client sees them | Runs in the photographer's browser at no server cost: tile sharpness, exposure percentiles (so low-key portraits and darker skin tones aren't flagged), difference hashes, and a face-landmark model | Tested on real galleries |
| **Studio Assistant** | Answers "which galleries expire this week?" and acts on it, like drafting reminder emails | Claude tool use; every action waits on the photographer's Approve card, checked in code, with full step traces | No made-up info: **96%** ([eval](web/evals/assistant/README.md), [architecture](web/docs/assistant-architecture.md)) |

Every AI call is recorded with its token cost, so each studio's AI use is tracked against its plan's allowance ([cost tracking](web/docs/ai-cost-tracking.md)).

## Everything else

- **Booking:** real open times, deposits and payment plans, reschedules, custom questions, and inspiration photos
- **Galleries:** watermarked proofs, client favorites and notes, paid extra photos, clean full-resolution delivery, and slideshows
- **Business:** contracts signed online, quotes and invoices, gift cards, coupons, session credits, review requests, and text reminders
- **Studio page:** each photographer's own page and booking form, styled with a page designer, plus a directory where nearby clients find them
- **Moving in:** a migration tool that moves a studio between PhotoEZ for WordPress and PhotoEZ Cloud
- **Store:** clients order photo prints and gifts from their gallery, made and shipped by SwaggPress Creations or by the studio itself

## Stack

- **App:** Next.js 16, TypeScript, Tailwind
- **Data:** PostgreSQL 18 with Drizzle ORM; photos on Cloudflare R2
- **Auth:** Better Auth
- **Payments:** Stripe Connect (clients pay each photographer directly, 0% commission) and Stripe Billing (plans)
- **AI:** Claude API (Opus for inquiry triage, Sonnet for the Assistant, Haiku for photo tags); MediaPipe in the browser for culling
- **Messaging:** SMTP email and Twilio texts, from each studio's own account
- **Tests:** Node's test runner with an in-memory Postgres (PGlite), 260+ tests
- **Hosting:** a Linux VPS with blue/green deploys (no downtime, one-command rollback) and nightly backups copied off-site and restore-tested

## About

Built by **Elle Jones**, Full-Stack AI Engineer in Portland, OR, and founder of [EJS Tech](https://ejstech.net). Elle is also a working photographer, which is where these features come from.
