<p align="center">
  <img src="web/public/brand/photoez-cloud-logo.webp" alt="PhotoEZ Cloud" width="280">
</p>

# PhotoEZ Cloud

**AI-assisted studio software for photographers.** Client galleries, inquiry handling, and delivery prep, with AI that does the busywork: reading inquiries, finding the right shots, and flagging the ones to cut.

PhotoEZ Cloud is the SaaS successor to the [PhotoEZ](https://ejstech.net) WordPress plugin suite, which I built and sell through EJS Tech. The plugins give photographers galleries, booking, contracts, and invoicing on their own sites. This project rebuilds the core as a hosted app and puts AI features at the center.

> **Status:** early development. Follow along in [Issues](../../issues) and the roadmap below.

## Planned AI features

| Feature | What it does | Techniques |
|---|---|---|
| **Inquiry triage** | Reads a new inquiry, extracts session type, date, budget, and questions, drafts a reply, and creates a lead | Structured outputs, prompt design, evals |
| **Gallery search** | Finds photos from a plain-language description, such as "first dance" or "shots with grandma" | Embeddings, vector search (pgvector) |
| **Culling suggestions** | Flags blurry frames, closed eyes, and near-duplicates before delivery | Vision models, a Python service, cost/accuracy tradeoffs |
| **Studio assistant** | Answers "which galleries expire this week?" and acts on it, for example by emailing reminders | Tool use, agents, an MCP server |

Every AI feature ships with an **eval set**, a labeled test set scored automatically in CI, so each change is measured, not guessed at.

## Stack

- **Web app:** Next.js, TypeScript
- **Database:** PostgreSQL with pgvector
- **AI/vision service:** Python, FastAPI
- **LLMs:** Claude API
- **CI:** GitHub Actions (tests and evals on every pull request)

## Roadmap

- [ ] Project setup and repository
- [ ] Core app: accounts, clients, photo upload, client gallery link with favorites
- [ ] Inquiry triage and first eval set
- [ ] Gallery search
- [ ] Culling suggestions
- [ ] Studio assistant and MCP server

## About

Built by **Elle Jones**, Full-Stack AI Engineer in Portland, OR, and founder of [EJS Tech](https://ejstech.net).
