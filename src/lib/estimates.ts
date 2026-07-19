import type { LiveRunListItem } from "./live-types";

/**
 * Run cost/time estimates. Static tier numbers are honest arithmetic
 * from stated assumptions (~$0.20 and ~30s per scenario at concurrency
 * 3) — but once this workspace has real completed runs, estimates come
 * from ITS OWN pace: the median per-scenario duration and cost over the
 * last few real (non-sandbox) runs. Your agent's numbers, not ours.
 */

export const DEFAULT_SECS_PER_SCENARIO = 10; // 30s/scenario ÷ concurrency 3
export const DEFAULT_COST_PER_SCENARIO = 0.2;

export interface Pace {
  secsPerScenario: number;
  costPerScenario: number;
  /** How many real runs informed this pace; 0 = the default assumptions. */
  samples: number;
}

export const DEFAULT_PACE: Pace = {
  secsPerScenario: DEFAULT_SECS_PER_SCENARIO,
  costPerScenario: DEFAULT_COST_PER_SCENARIO,
  samples: 0,
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Derive the workspace's pace from its run history (newest first, as
 * the runs API returns it). Only completed real-provider runs count —
 * sandbox runs are instant and free, and would poison the estimate.
 */
export function paceFromHistory(runs: LiveRunListItem[]): Pace {
  const usable = runs
    .filter(
      (r) =>
        r.status === "complete" &&
        r.provider === "anthropic" &&
        !!r.finishedAt &&
        r.total >= 5 &&
        (r.costUsd ?? 0) > 0,
    )
    .slice(0, 5);
  if (usable.length === 0) return DEFAULT_PACE;

  const secs = usable.map(
    (r) => (new Date(r.finishedAt!).getTime() - new Date(r.startedAt).getTime()) / 1000 / r.total,
  );
  const costs = usable.map((r) => (r.costUsd ?? 0) / r.total);
  return {
    secsPerScenario: Math.max(0.5, median(secs)),
    costPerScenario: Math.max(0.001, median(costs)),
    samples: usable.length,
  };
}

/** "~$2,000 · ~28 h" for a suite of `size` at the given pace. Rounded
 * numbers on purpose — these are estimates, and they should read like
 * estimates: full dollars with separators, hours to the nearest half. */
export function fmtEstimate(size: number, pace: Pace): string {
  const cost = size * pace.costPerScenario;
  const mins = (size * pace.secsPerScenario) / 60;
  const c =
    cost >= 10
      ? `~$${Math.round(cost).toLocaleString()}`
      : `~$${cost.toFixed(cost >= 1 ? 0 : 2)}`;
  const halfHours = Math.round((mins / 60) * 2) / 2;
  const t =
    mins < 1
      ? "<1 min"
      : mins < 60
        ? `~${Math.round(mins)} min`
        : `~${halfHours} h`;
  return `${c} · ${t}`;
}
