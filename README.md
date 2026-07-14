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

## The screens

| Route | What it is |
| --- | --- |
| `/` | Landing — hero, autoplaying wall loop (the real component, not a video) |
| `/dashboard` | Agents under test, readiness card, sparklines |
| `/runs` | **Mission Control** — the wall of 200 cells filling in over ~30s |
| `/replay/[id]` | **Replay** — saw / did / expected columns, divergence marker, ←/→ scrubber |
| `/reports` | The readiness report — a document, not a dashboard; printable |
| `/benchmark` | v1.2 vs v1.3 diff — newly passing / newly broken |
| `/scenarios` | Scenario library — table, detail drawer, new-scenario form |
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
