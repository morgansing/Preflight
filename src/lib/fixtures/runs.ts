import type { Outcome, Scenario } from "@/lib/types";
import { demoAgents } from "./agents";
import { demoBenchmark } from "./benchmark";
import { demoOutcomes, scenarioById, scenarios } from "./scenarios";
import { DEMO_RUN_DURATION_MS, demoRun, runStats } from "./run";
import { intBetween, mulberry32, shuffled } from "@/lib/seeded";

/**
 * The demo run history: every agent's scoreHistory rendered as concrete,
 * openable runs. Each run gets deterministic per-scenario outcomes that
 * reconcile with the rest of the demo:
 *
 *   - run_0147 (Aurora v1.3, latest) IS the demo run — outcomes are
 *     demoOutcomes byte-for-byte.
 *   - run_0139 (Aurora v1.2) fails exactly what the benchmark says it
 *     fails (the newly-passing list + the unchanged fails) and passes
 *     what v1.3 newly broke.
 *   - Every agent's latest run matches its fixture breakdown per
 *     category; older runs scale that miss profile up, and a scenario
 *     fixed in a later run stays fixed (misses nest oldest ⊇ newest).
 */

export interface PastRun {
  id: string; // "run_0147"
  agentId: string;
  agentName: string;
  agentVersion: string;
  suite: string;
  score: number;
  passed: number;
  failed: number;
  partial: number;
  /** Outright fails on critical-severity scenarios. */
  critical: number;
  total: number;
  label: string; // "3d ago"
  durationMs: number;
  costUsd: number;
  /** Score delta vs the same agent's previous run; undefined on the oldest. */
  delta?: number;
}

/* ------------------------------------------------------------------ */
/* The timeline. Ids are global and chronological (higher = newer);   */
/* labels are display fiction but stay monotonic with the ids. The    */
/* three anchors — run_0147, run_0141, run_0139 — are the runIds the  */
/* agents fixture and benchmark already reference. Newest first, one  */
/* entry per scoreHistory point.                                      */
/* ------------------------------------------------------------------ */

const RUN_SPECS: Record<string, [id: string, label: string][]> = {
  agent_aurora: [
    ["run_0147", "2m ago"],
    ["run_0146", "10h ago"],
    ["run_0145", "16h ago"],
    ["run_0144", "20h ago"],
    ["run_0143", "1d ago"],
    ["run_0142", "1d ago"],
    ["run_0136", "4d ago"],
    ["run_0133", "5d ago"],
    ["run_0129", "7d ago"],
    ["run_0126", "9d ago"],
  ],
  agent_aurora_12: [
    ["run_0139", "3d ago"],
    ["run_0138", "4d ago"],
    ["run_0134", "5d ago"],
    ["run_0131", "6d ago"],
    ["run_0128", "8d ago"],
    ["run_0125", "9d ago"],
    ["run_0123", "11d ago"],
    ["run_0121", "13d ago"],
    ["run_0119", "15d ago"],
    ["run_0118", "17d ago"],
  ],
  agent_checkout: [
    ["run_0141", "1d ago"],
    ["run_0140", "2d ago"],
    ["run_0137", "4d ago"],
    ["run_0135", "5d ago"],
    ["run_0132", "6d ago"],
    ["run_0130", "7d ago"],
    ["run_0127", "8d ago"],
    ["run_0124", "10d ago"],
    ["run_0122", "12d ago"],
    ["run_0120", "14d ago"],
  ],
};

const runNumber = (id: string) => parseInt(id.slice(4), 10);

/* ------------------------------------------------------------------ */
/* Per-run outcomes                                                   */
/* ------------------------------------------------------------------ */

const byCategory = new Map<string, Scenario[]>();
for (const s of scenarios) {
  const list = byCategory.get(s.category) ?? [];
  list.push(s);
  byCategory.set(s.category, list);
}

// v1.2's benchmark contract: it failed the newly-passing list and the
// unchanged fails, and passed everything v1.3 newly broke.
const v12MustFail = new Set([
  ...demoBenchmark.newlyPassing.map((e) => e.scenarioId),
  ...demoBenchmark.unchangedFails.map((e) => e.scenarioId),
]);
const v12MustPass = new Set(demoBenchmark.newlyBroken.map((e) => e.scenarioId));

/** Latest-run misses the agent's own history must stay consistent with. */
const latestMissIds = new Set(
  [...demoOutcomes.entries()].filter(([, o]) => o !== "pass").map(([id]) => id),
);

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Stable per-agent miss order within a category: pinned misses first
 * (so they persist across the agent's history), must-pass ids last. */
const missOrderCache = new Map<string, string[]>();
function missOrder(agentId: string, category: string): string[] {
  const key = `${agentId}:${category}`;
  const hit = missOrderCache.get(key);
  if (hit) return hit;

  const ids = (byCategory.get(category) ?? []).map((s) => s.id);
  // The demo run's misses are the suite's hardest scenarios — every
  // agent fails those first, so the story holds across surfaces.
  const pinned =
    agentId === "agent_aurora_12"
      ? ids.filter((id) => v12MustFail.has(id))
      : ids.filter((id) => latestMissIds.has(id));
  const last = agentId === "agent_aurora_12" ? ids.filter((id) => v12MustPass.has(id)) : [];
  const rest = ids.filter((id) => !pinned.includes(id) && !last.includes(id));

  const rng = mulberry32(0x5eed_0004 ^ hashCode(key));
  const order = [...pinned, ...shuffled(rng, rest), ...last];
  missOrderCache.set(key, order);
  return order;
}

/** How a given scenario presents when missed — stable across runs. */
function missKind(agentId: string, scenarioId: string): Outcome {
  const demo = demoOutcomes.get(scenarioId);
  if (agentId === "agent_aurora_12" && v12MustFail.has(scenarioId)) return "fail";
  if (demo && demo !== "pass") return demo;
  const rng = mulberry32(0x5eed_0005 ^ hashCode(scenarioId));
  return rng() < 0.18 ? "partial" : "fail";
}

/** Spread a run's total miss count across categories: the agent's
 * latest-run miss profile, scaled by largest remainder with caps. */
function missTargets(agentId: string, misses: number): Map<string, number> {
  const agent = demoAgents.find((a) => a.id === agentId)!;
  const breakdown = agent.breakdown ?? [];
  const latest = breakdown.map((b) => ({ ...b, miss: b.total - b.pass }));
  const latestTotal = latest.reduce((sum, b) => sum + b.miss, 0);

  const targets = new Map<string, number>();
  if (misses === latestTotal) {
    for (const b of latest) targets.set(b.category, b.miss);
    return targets;
  }

  // A small floor lets categories the latest run passes absorb spill
  // on much weaker historical runs.
  const weights = latest.map((b) => b.miss + 0.15);
  const weightTotal = weights.reduce((a, w) => a + w, 0);
  const shares = latest.map((b, i) => (misses * weights[i]) / weightTotal);
  const alloc = latest.map((b, i) => Math.min(b.total, Math.floor(shares[i])));

  let left = misses - alloc.reduce((a, n) => a + n, 0);
  const order = latest
    .map((_, i) => i)
    .sort((a, b) => (shares[b] - Math.floor(shares[b])) - (shares[a] - Math.floor(shares[a])));
  while (left > 0) {
    let placed = false;
    for (const i of order) {
      if (left === 0) break;
      if (alloc[i] < latest[i].total) {
        alloc[i] += 1;
        left -= 1;
        placed = true;
      }
    }
    if (!placed) break; // every category saturated — can't happen at ≤200
  }

  latest.forEach((b, i) => targets.set(b.category, alloc[i]));
  return targets;
}

const outcomesCache = new Map<string, Map<string, Outcome>>();

function buildOutcomes(run: PastRun): Map<string, Outcome> {
  if (run.id === demoRun.id) return demoOutcomes;

  const targets = missTargets(run.agentId, run.total - run.passed);
  const outcomes = new Map<string, Outcome>();
  for (const s of scenarios) outcomes.set(s.id, "pass");
  for (const [category, count] of targets) {
    for (const id of missOrder(run.agentId, category).slice(0, count)) {
      outcomes.set(id, missKind(run.agentId, id));
    }
  }
  return outcomes;
}

/* ------------------------------------------------------------------ */
/* Build the history                                                  */
/* ------------------------------------------------------------------ */

function buildRuns(): { all: PastRun[]; byAgent: Map<string, PastRun[]> } {
  const byAgent = new Map<string, PastRun[]>();

  for (const agent of demoAgents) {
    const specs = RUN_SPECS[agent.id];
    const newestFirst = [...agent.scoreHistory].reverse();
    const runs = specs.map(([id, label], i) => {
      const score = newestFirst[i];
      const rng = mulberry32(0x5eed_0006 ^ runNumber(id));
      const run: PastRun = {
        id,
        agentId: agent.id,
        agentName: agent.name,
        agentVersion: agent.version,
        suite: demoRun.suite,
        score,
        // 200-scenario suite: score*2, except the demo run itself, where
        // 193/200 = 96.5 rounds up to the 97 headline.
        passed: id === agent.lastRun.runId ? agent.lastRun.passed : score * 2,
        failed: 0,
        partial: 0,
        critical: 0,
        total: 200,
        label,
        durationMs:
          id === demoRun.id ? DEMO_RUN_DURATION_MS : intBetween(rng, 26_000, 38_000),
        costUsd: id === demoRun.id ? runStats.costUsd : intBetween(rng, 185, 265) / 100,
        delta: i < newestFirst.length - 1 ? score - newestFirst[i + 1] : undefined,
      };
      const outcomes = buildOutcomes(run);
      outcomesCache.set(id, outcomes);
      for (const [scenarioId, o] of outcomes) {
        if (o === "fail") {
          run.failed += 1;
          if (scenarioById.get(scenarioId)?.severity === "critical") run.critical += 1;
        } else if (o === "partial") run.partial += 1;
      }
      return run;
    });
    byAgent.set(agent.id, runs);
  }

  const all = [...byAgent.values()].flat().sort((a, b) => runNumber(b.id) - runNumber(a.id));
  return { all, byAgent };
}

const built = buildRuns();

/** Every demo run, workspace-wide, newest first. */
export const pastRuns: PastRun[] = built.all;

/** Each agent's runs, newest first. */
export const runsByAgent: Map<string, PastRun[]> = built.byAgent;

export function getPastRun(id: string): PastRun | undefined {
  return pastRuns.find((r) => r.id === id);
}

/** Per-scenario outcomes for a past run (base-200 scenario ids). */
export function runOutcomes(id: string): Map<string, Outcome> | undefined {
  return outcomesCache.get(id);
}

/** Outcomes of an agent's most recent run — the scenario-level truth
 * behind its fixture breakdown. */
export function latestRunOutcomes(agentId: string): Map<string, Outcome> | undefined {
  const latest = runsByAgent.get(agentId)?.[0];
  return latest && runOutcomes(latest.id);
}

/** Pass/total per category for a run, in suite category order. */
export function categoryResults(id: string): { category: string; pass: number; total: number }[] {
  const outcomes = runOutcomes(id);
  if (!outcomes) return [];
  return [...byCategory.entries()].map(([category, list]) => ({
    category,
    pass: list.filter((s) => outcomes.get(s.id) === "pass").length,
    total: list.length,
  }));
}
