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

`npm run build && npm start` for production. No API keys, no database, no
network required — Demo mode is fully self-contained.

## The two modes

A persistent switch at the bottom of the nav rail toggles Demo/Live (stored in
localStorage). Same components, same routes — only the data source differs.

- **Demo mode** (default): one pre-baked run — 200 scenarios, 182 pass / 15
  fail / 3 partial → 91% — replayed with scripted timings so Mission Control
  looks live but is identical every time. Six failure replays are hand-authored
  end-to-end; every other cell gets a deterministic generated replay so no
  click is a dead end. Demo mode makes zero network calls.
- **Live mode**: honest scaffolding for the real product. Register an agent
  (HTTP endpoint, MCP endpoint, or the built-in reference agent) via
  Agents → Connect. With no runs recorded, every surface shows a calm empty
  state — Live mode never falls back to scripted data.

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

Steps 1–6 and 9 are complete (design system, Mission Control, Readiness Card +
Dashboard, Replay, Reports/Benchmark/Scenarios, mode switch + Live scaffolding,
landing). Steps 7–8 — the Prisma-backed simulated store, run harness, LLM judge
and reference agent that make Live mode produce real runs — are the next
milestone.
