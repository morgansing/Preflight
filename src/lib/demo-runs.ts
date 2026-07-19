"use client";

import { useSyncExternalStore } from "react";
import { demoAgents } from "./fixtures/agents";
import { missKind, missOrder, pastRuns, type PastRun } from "./fixtures/runs";
import { demoOutcomes, gauntletScenarioIds, scenarioById, scenarios } from "./fixtures/scenarios";
import { SMOKE_SUITE } from "./suites";
import { between, intBetween, mulberry32, shuffled } from "./seeded";
import type { Outcome, RunCell } from "./types";

/**
 * Fake tests in demo mode: the user picks an agent + suite, watches a
 * wall fill in, and the finished run joins the run history — all
 * fixture-pure (localStorage, no network, no DB).
 *
 * Coherence rules: outcomes are drawn from the agent's canonical
 * missOrder/missKind (fixtures/runs.ts), so a fake run never contradicts
 * the agent's story; a cell links to a replay only when the demo
 * replay actually shows that outcome.
 */

export type DemoSuiteId = "smoke" | "standard" | "gauntlet";

export interface DemoSuiteDef {
  id: DemoSuiteId;
  name: string;
  scenarioIds: string[];
  /** Wall playback duration. */
  durationMs: number;
  blurb: string;
}

export function demoSuites(): DemoSuiteDef[] {
  return [
    {
      id: "smoke",
      name: "Smoke",
      scenarioIds: SMOKE_SUITE,
      durationMs: 9_000,
      blurb: "24 scenarios, every category incl. the traps.",
    },
    {
      id: "standard",
      name: "Standard",
      scenarioIds: scenarios.map((s) => s.id),
      durationMs: 32_000,
      blurb: "The full 200-scenario base suite.",
    },
    {
      id: "gauntlet",
      name: "Gauntlet",
      scenarioIds: gauntletScenarioIds,
      durationMs: 12_000,
      blurb: "Difficulty 4–5 only — no warm-up.",
    },
  ];
}

export interface SessionRun {
  id: string; // "run_0148"
  agentId: string;
  agentName: string;
  agentVersion: string;
  suiteId: DemoSuiteId;
  scenarioIds: string[];
  /** Final outcomes, scenarioId → outcome. */
  outcomes: Record<string, Outcome>;
  startedAtIso: string;
  durationMs: number;
  costUsd: number;
}

/* ----------------------------- generator ----------------------------- */

const runNumber = (id: string) => parseInt(id.slice(4), 10);

export function nextRunId(existing: SessionRun[]): string {
  const max = Math.max(
    ...pastRuns.map((r) => runNumber(r.id)),
    ...existing.map((r) => runNumber(r.id)),
  );
  return `run_${String(max + 1).padStart(4, "0")}`;
}

/**
 * Synthesize outcomes for one fake run. Deterministic per run id.
 * Misses per category come from the agent's latest-run profile
 * restricted to the chosen suite, ± seeded jitter, drawn in the
 * agent's stable missOrder so fake runs nest into its history.
 */
export function buildSessionRun(
  agentId: string,
  suiteId: DemoSuiteId,
  runId: string,
): SessionRun {
  const agent = demoAgents.find((a) => a.id === agentId) ?? demoAgents[0];
  const suite = demoSuites().find((s) => s.id === suiteId) ?? demoSuites()[0];
  const rng = mulberry32(0x5eed_0008 ^ runNumber(runId));
  const inSuite = new Set(suite.scenarioIds);

  const outcomes: Record<string, Outcome> = {};
  for (const id of suite.scenarioIds) outcomes[id] = "pass";

  for (const b of agent.breakdown ?? []) {
    // The agent's canonical miss list for this category, restricted to
    // the suite — the front of missOrder is what it "still gets wrong".
    const order = missOrder(agent.id, b.category).filter((id) => inSuite.has(id));
    if (order.length === 0) continue;
    const categoryTotal = scenarios.filter(
      (s) => s.category === b.category && inSuite.has(s.id),
    ).length;
    const missRate = (b.total - b.pass) / b.total;
    const expected = missRate * categoryTotal;
    // Seeded jitter around the expected miss count, clamped to bounds.
    const jitter = between(rng, -0.9, 0.9);
    const k = Math.max(0, Math.min(order.length, Math.round(expected + jitter)));
    for (const id of order.slice(0, k)) outcomes[id] = missKind(agent.id, id);
  }

  const costUsd = +(suite.scenarioIds.length * between(rng, 0.009, 0.013)).toFixed(2);

  return {
    id: runId,
    agentId: agent.id,
    agentName: agent.name,
    agentVersion: agent.version,
    suiteId,
    scenarioIds: suite.scenarioIds,
    outcomes,
    startedAtIso: new Date().toISOString(),
    durationMs: suite.durationMs,
    costUsd,
  };
}

/** Scripted wall timings for a session run — rebuilt deterministically,
 * mirroring the pre-baked demo run's fill-in feel. */
export function buildCells(run: SessionRun): RunCell[] {
  const rng = mulberry32(0x5eed_0009 ^ runNumber(run.id));
  const order = shuffled(rng, run.scenarioIds);
  const cells: RunCell[] = order.map((scenarioId, i) => {
    const slot = 1200 + (i / order.length) * (run.durationMs - 2800);
    const resolveAt = Math.round(slot + between(rng, -500, 500));
    const latencyMs = intBetween(rng, 2400, 7800);
    const tokens = intBetween(rng, 900, 4200);
    return {
      scenarioId,
      outcome: run.outcomes[scenarioId] ?? "pass",
      startAt: Math.max(0, resolveAt - latencyMs),
      resolveAt,
      tokens,
      costUsd: +(tokens * 0.0000042).toFixed(4),
      latencyMs,
    };
  });
  cells.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  return cells;
}

/** A cell may link to /replay/[id] only when the demo replay would show
 * the same outcome this run produced — links never lie. */
export function canLinkReplay(scenarioId: string, outcome: Outcome): boolean {
  return (demoOutcomes.get(scenarioId) ?? "pass") === outcome;
}

/** Project a SessionRun onto the PastRun list shape for shared pages. */
export function toPastRun(run: SessionRun, previousScore?: number): PastRun {
  let pass = 0;
  let fail = 0;
  let partial = 0;
  let critical = 0;
  for (const [id, o] of Object.entries(run.outcomes)) {
    if (o === "pass") pass += 1;
    else if (o === "fail") {
      fail += 1;
      if (scenarioById.get(id)?.severity === "critical") critical += 1;
    } else partial += 1;
  }
  const total = run.scenarioIds.length;
  const score = total ? Math.round((pass / total) * 100) : 0;
  return {
    id: run.id,
    agentId: run.agentId,
    agentName: run.agentName,
    agentVersion: run.agentVersion,
    suite:
      run.suiteId === "standard"
        ? "Ecommerce Support Suite v2"
        : run.suiteId === "gauntlet"
          ? "Gauntlet · hard scenarios"
          : "Smoke suite",
    score,
    passed: pass,
    failed: fail,
    partial,
    critical,
    total,
    label: agoLabel(run.startedAtIso),
    durationMs: run.durationMs,
    costUsd: run.costUsd,
    delta: previousScore !== undefined ? score - previousScore : undefined,
  };
}

function agoLabel(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* --------------------------- localStorage ---------------------------- */

const KEY = "preflight.demo.runs";
const EMPTY: SessionRun[] = Object.freeze([]) as unknown as SessionRun[];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribeStore(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

let cacheRaw: string | null = null;
let cacheParsed: SessionRun[] = EMPTY;

function getSnapshot(): SessionRun[] {
  const raw = window.localStorage.getItem(KEY) ?? "[]";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      cacheParsed = JSON.parse(raw);
    } catch {
      cacheParsed = EMPTY;
    }
  }
  return cacheParsed;
}

function getServerSnapshot(): SessionRun[] {
  return EMPTY;
}

/** Newest first. */
export function useSessionRuns(): SessionRun[] {
  return useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
}

export function addSessionRun(run: SessionRun): void {
  const current = getSnapshot().filter((r) => r.id !== run.id);
  // Cap stored fake runs so localStorage stays small.
  const next = [run, ...current].slice(0, 20);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  emit();
}

export function getSessionRun(id: string): SessionRun | undefined {
  if (typeof window === "undefined") return undefined;
  return getSnapshot().find((r) => r.id === id);
}
