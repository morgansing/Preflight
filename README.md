# Preflight

**The flight simulator for AI agents.** Preflight tests AI support agents against
hundreds of realistic scenarios in a simulated store — before they ever touch a
real customer — and produces a readiness verdict: what passes, where it breaks,
and step-by-step replays of every failure.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

`npm run build && npm start` for production. Demo mode needs no API keys
and makes zero network calls. (`npm run dev`/`start` auto-create the SQLite
store via `prisma db push`.)

## The two modes

A persistent switch at the bottom of the nav rail toggles Demo/Live (stored in
localStorage). Same components, same routes — only the data source differs.

- **Demo mode** (default): one pre-baked run — 200 scenarios, 182 pass / 15
  fail / 3 partial → 91% — replayed with scripted timings so Mission Control
  looks live but is identical every time. Six failure replays are hand-authored
  end-to-end; every other cell gets a deterministic generated replay so no
  click is a dead end. Demo mode makes zero network calls.
- **Live mode**: the real product. The harness resets + reseeds a simulated
  store (Prisma + SQLite: ~500 orders full of realistic mess, grounded in the
  scenario suite), then runs each scenario as a genuine multi-turn
  conversation — an LLM customer persona against the agent under test, which
  drives real store tools (`get_order`, `issue_refund`, `escalate`, …). An
  LLM judge grades every transcript against the scenario rubric via a strict
  JSON-schema tool call. Results stream into Mission Control over SSE (with
  DB catch-up on refresh) and persist in the demo replay shape, so Replay,
  Reports and Benchmark work identically in both modes. Live mode never
  falls back to scripted data.

  Setup: `PREFLIGHT_LLM_KEY=sk-ant-…` (or `ANTHROPIC_API_KEY`) on the
  server. Models default to `claude-opus-4-8` (override `PREFLIGHT_MODEL`;
  `PREFLIGHT_CONCURRENCY` sets parallel scenarios, default 3).
  Live runs pick a **suite tier**: Smoke 24 (default) · Standard 200 ·
  Extended 500 · Scale 1,000 · Exhaustive 5,000 · Max 10,000. The first
  200 scenarios are the hand-shaped base suite; larger tiers extend it
  deterministically across the same category proportions, every scenario
  grounded in the seeded store. Tier cards show estimated cost and
  duration up front (Max ≈ $2,000 · ≈ 28 h at Opus pricing) and the run
  header ticks the real numbers. The built-in
  **reference agent** is deliberately imperfect *by incentive* — its prompt
  optimizes for "resolve fast, keep the customer happy, avoid escalating" —
  so its refund-fraud/duplicate/escalation failures are genuine model
  behavior. Infra failures render as amber "run error", excluded from the
  score — red only ever means the agent failed.

  For development/CI without a key, `PREFLIGHT_LLM_KEY=mock` selects an
  explicitly-labeled deterministic mock provider (visible MOCK PROVIDER
  badge on every surface) that exercises the real store, tools, harness,
  persistence and streaming with scripted agent behavior. It is an explicit
  setting, never a fallback.

## Setup wizard + custom suite generation (Phase A + B)

`/setup` turns "a connected agent" into a confirmed **Agent Dossier** and
an approved **Rulebook**, then generates a bespoke scenario suite from it —
so the test is built from *your* rules, not a generic library.

- **The wizard** (5 steps): role → agent → capabilities + dossier
  (platform, tone, risk tolerance — the generator reads all of it) →
  policy → Rulebook. Four optional policy inputs converge on one Rulebook:
  paste a help-centre URL (server crawl), paste/upload documents, paste the
  agent's system prompt, or answer 7 questions (pure templating, no LLM).
  Rules are AI-drafted (strict-schema extraction) and human-approved on the
  editable Rulebook screen — the trust checkpoint.
- **Generation** (`/api/generate`): each approved rule × a **pressure grid**
  — emotion (calm → legal threat), **boundary amounts** (a £500 rule yields
  £499 / £500 / £501 scenarios — thresholds are where agents break),
  identity (regular/VIP/new/suspected-fraud), deception (honest/embellished/
  fraudulent). Risk tolerance biases how adversarial the mix is. Each
  scenario ships with **matching store fixtures**, so its hidden facts are
  true in the environment (the signed delivery record actually exists).
- The generated suite is versioned, appears in the run launcher as a
  **Custom · From your Rulebook** tier (`custom:<version>`), and flows
  through the wall, replay, report and benchmark unchanged — results carry a
  scenario snapshot so replays survive suite regeneration.

## The screens

| Route | What it is |
| --- | --- |
| `/` | Landing — hero, autoplaying wall loop (the real component, not a video) |
| `/dashboard` | Agents under test, readiness card, sparklines |
| `/setup` | **Setup wizard** — Agent Dossier, 4 policy inputs, Rulebook, generate |
| `/runs` | **Mission Control** — the wall filling in live (24 → 10,000 cells) |
| `/replay/[id]` | **Replay** — saw / did / expected columns, divergence marker, ←/→ scrubber |
| `/reports` | The readiness report — a document, not a dashboard; printable |
| `/benchmark` | Two-run diff — newly passing / newly broken |
| `/scenarios` | Scenario library — size selector (200 → 10,000), paginated |
| `/components` | Design-system proof page |

## Architecture

- Next.js (App Router) + TypeScript + Tailwind v4 — design tokens live in
  `src/app/globals.css` (`@theme`), per the design system: one signal-green
  accent, red reserved exclusively for failures, serif numerals for scores.
- All demo data is generated deterministically from a seeded PRNG
  (`src/lib/seeded.ts`) in `src/lib/fixtures/` — scenarios, run timings,
  replays, benchmark, report.
- Mode context in `src/lib/mode.tsx`; live agent registry scaffolding in
  `src/lib/live.ts`.

## Status vs the build brief

All nine build steps are complete: design system, Mission Control, Readiness
Card + Dashboard, Replay, Reports/Benchmark/Scenarios, mode switch, the
simulated store (Prisma schema + deterministic seed + tools), the harness +
judge + reference agent wiring Live mode end to end, and the landing page.
Server code lives in `src/server/` (seed, store tools, providers, harness,
prompts, SSE bus); live API routes in `src/app/api/live/`. Not yet built:
MCP-endpoint agents (registered but rejected at run time with honest copy),
auth, and Postgres.
