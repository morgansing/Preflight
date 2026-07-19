# Preflight

**The flight simulator for AI agents.** Preflight runs AI support agents
through hundreds of realistic scenarios in a simulated store — before they
ever touch a real customer — and produces a readiness verdict: what passes,
where it breaks, a root-cause diagnosis for every failure pattern, and a
step-by-step replay of every conversation.

[![Preflight](https://your-preflight-host/api/badge/demo)](https://your-preflight-host/share/demo)
*Every completed run can mint a public, verifiable score badge like this one.*

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
```

Demo mode needs no API keys and makes zero network calls — the full product
tour works offline, including launching a **fake test** and watching the wall
fill in. (`npm run dev`/`start` auto-create the SQLite store via
`prisma db push`.)

For real evaluations, set one env var:

```bash
PREFLIGHT_LLM_KEY=sk-ant-…   # or ANTHROPIC_API_KEY
```

`PREFLIGHT_LLM_KEY=mock` selects an explicitly-labeled deterministic provider
for development and CI — never a silent fallback. Sandbox runs (no key at
all) run the built-in reference agent free and offline. See `.env.example`
for everything else — every subsystem below that needs credentials is
**built and dormant** until its keys exist.

## What a test is

A scenario is a *setup* — customer persona, opening message, hidden facts,
pass criteria, must-nots, severity, and a difficulty grade (1 Routine → 5
Brutal). In a live run, an LLM customer persona **improvises** the
conversation from that setup against your agent, which drives real store
tools (`get_order`, `issue_refund`, `escalate`, …) against a seeded
simulated store. An LLM judge grades every transcript against the rubric —
critical-severity fails require a **second independent judge pass** to be
confirmed. Scores carry a **95% confidence interval**; infra failures render
amber "run error" and never count against the agent. Red only ever means the
agent failed.

**Two scenario sources:**

- **The built-in library** — 200 hand-shaped base scenarios across 11
  categories (traps included), extended deterministically to 10,000. Run it
  at any depth: Smoke 24 · Standard 200 · Extended 500 · Scale 1,000 ·
  Exhaustive 5,000 · Max 10,000, plus **The Gauntlet** (the 23 difficulty
  4–5 scenarios — included in Standard and above, rerunnable alone) and the
  **prompt-injection Security suite** (attacks planted in store data).
- **Your Rulebook suite** — the Setup wizard turns your policy (help-centre
  URL, docs, system prompt, **real conversation transcripts**, or 7
  questions) into an approved Rulebook, then generates scenarios from each
  rule × a pressure grid: emotion, boundary amounts (a £500 rule yields
  £499/£500/£501), identity, deception, and adversarial tactics up the
  difficulty ladder. The only test that knows *your* policies.
- **Red-team suites** — one click on any report turns that run's failure
  clusters into a new suite that attacks exactly where the agent already
  cracked. Your agent's weaknesses become its next exam.

## What you get after a run

- **The wall** — every scenario a cell, filterable to just the fails;
  every cell opens the full transcript replay with the divergence marker.
- **The readiness report** — score ± CI, strengths/weaknesses,
  *N problems not M failures* (root-cause clusters with fixes and proof
  replays), the risks that matter, and a **"What this score covers"** panel
  that says out loud when your own policies were never tested.
- **Flight plans** — one job that runs several suites sequentially
  (coverage + security + your Rulebook), auto-advancing, with an aggregate
  sign-off report whose verdict is a checklist, not an average.
- **Regression vs baseline** — pin a baseline; every run diffs against it
  (newly broken / newly fixed), with webhook alerts on regressions.
- **Shareable proof** — a public read-only result page, an embeddable SVG
  score badge, and a PDF export of the report.

## CI: gate your agent like you gate your tests

```yaml
# .github/workflows/preflight.yml
- uses: your-org/preflight@main
  with:
    endpoint: ${{ secrets.AGENT_ENDPOINT }}
    suite: smoke
    min-score: 90
```

The bundled Action (`action.yml` + `scripts/preflight-gate.mjs`) runs a
suite against your agent on every PR, comments the scorecard, and fails the
check below your threshold. For **continuous monitoring**, run it on a
schedule and gate against the pinned baseline:

```yaml
on:
  schedule:
    - cron: "0 3 * * *"   # nightly standard run; alerts via PREFLIGHT_WEBHOOK_URL
```

## Operations

- `GET /api/health` — subsystem status for uptime monitors.
- `PREFLIGHT_WEBHOOK_URL` — Slack-compatible notifications on run
  completion and regressions.
- `PREFLIGHT_RETENTION_DAYS` — transcript pruning (scores kept forever).
- Interrupted runs **resume automatically** after a restart or deploy,
  continuing from the last written result.
- `npm run calibrate` — replays the hand-labeled calibration set through
  the judge and prints agreement + a confusion matrix
  (`CALIBRATE=real` measures the production judge).
- `npm run e2e` — Playwright golden paths (demo replay, fake test,
  filters, sandbox run, share/badge loop); CI runs them on every push.

## Production activation

Everything ships dormant and flips on with env vars — no code changes:

| Subsystem | Activation | Docs |
| --- | --- | --- |
| Postgres/Supabase DB | `DATABASE_URL` + adapter swap | `docs/PRODUCTION.md` §1 |
| Stripe billing (plans + token ledger) | 2 env vars + price lookup_keys | `docs/PRODUCTION.md` §2 |
| Supabase auth (all mutating routes) | `SUPABASE_JWT_SECRET` | `docs/PRODUCTION.md` §3 |

The prioritised list of deliberate V0 trade-offs lives in `docs/ROADMAP.md`.

## Architecture

- Next.js (App Router) + TypeScript + Tailwind v4; design tokens in
  `src/app/globals.css` (`@theme`) — one signal-green accent, red reserved
  exclusively for failures, serif numerals for scores.
- Demo world generated deterministically from a seeded PRNG in
  `src/lib/fixtures/` and locked by contract tests (`npm test`, 44 tests) —
  scores, miss orders, and replays are consistent across every surface.
- Server in `src/server/` (harness, providers, judge, seed, store tools,
  billing, auth, share, notify); live API routes in `src/app/api/`.
- Runs are isolated: each seeds its own run-scoped store slice, so several
  evaluations execute concurrently (`PREFLIGHT_MAX_CONCURRENT_RUNS`,
  default 2); flight plans queue and auto-advance, steps strictly in order.
