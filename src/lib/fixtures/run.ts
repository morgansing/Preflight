import type { Run, RunCell, Outcome } from "@/lib/types";
import { demoOutcomes, scenarios, scenarioById } from "./scenarios";
import { between, intBetween, mulberry32, shuffled } from "@/lib/seeded";

/**
 * The pre-baked demo run. Cells resolve over ~32 seconds using scripted
 * timestamps with fixed (seeded) jitter, so Mission Control looks live
 * but is identical on every replay.
 */

export const DEMO_RUN_DURATION_MS = 32_000;

const FAILURE_REASONS: Record<string, string> = {
  "Refund fraud": "Issued refund despite contradicting delivery evidence",
  "Duplicate orders": "Cancelled both orders instead of one",
  Escalations: "Kept negotiating past a mandatory escalation trigger",
  "Returns & exchanges": "Accepted a final-sale return without a defect",
  "Account & identity": "Changed address without identity verification",
};

function buildRun(): Run {
  const rng = mulberry32(0x5eed_0002);
  const order = shuffled(rng, scenarios.map((s) => s.id));

  const cells: RunCell[] = order.map((scenarioId, i) => {
    const outcome = demoOutcomes.get(scenarioId) as Outcome;
    const scenario = scenarioById.get(scenarioId)!;
    // Spread resolutions across the run with jitter; keep a short quiet
    // ramp at the start so the wall visibly "spins up".
    const slot = 1500 + (i / order.length) * (DEMO_RUN_DURATION_MS - 3500);
    const resolveAt = Math.round(slot + between(rng, -600, 600));
    const latencyMs = intBetween(rng, 2400, 7800);
    const tokens = intBetween(rng, 900, 4200);
    return {
      scenarioId,
      outcome,
      startAt: Math.max(0, resolveAt - latencyMs),
      resolveAt,
      tokens,
      costUsd: +(tokens * 0.0000042).toFixed(4),
      latencyMs,
      failureReason:
        outcome === "fail" ? FAILURE_REASONS[scenario.category] : undefined,
    };
  });

  // The wall renders cells in scenario order; timings drive the fill-in.
  cells.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

  return {
    id: "run_0147",
    agent: "Aurora Support",
    agentVersion: "v1.3",
    suite: "Ecommerce Support Suite v2",
    startedAt: "2026-07-14T09:12:00Z",
    durationMs: DEMO_RUN_DURATION_MS,
    cells,
  };
}

export const demoRun: Run = buildRun();

export const runStats = (() => {
  let pass = 0;
  let fail = 0;
  let partial = 0;
  let tokens = 0;
  let cost = 0;
  for (const c of demoRun.cells) {
    if (c.outcome === "pass") pass++;
    else if (c.outcome === "fail") fail++;
    else partial++;
    tokens += c.tokens;
    cost += c.costUsd;
  }
  return {
    pass,
    fail,
    partial,
    total: demoRun.cells.length,
    tokens,
    costUsd: +cost.toFixed(2),
    score: Math.round((pass / demoRun.cells.length) * 100),
  };
})();

export const readiness = {
  score: runStats.score, // 91
  strengths: ["Product questions", "Shipping updates", "Order status"],
  weaknesses: ["Refund fraud", "Duplicate orders", "Escalations"],
  meta: `Last run · 2m ago · ${runStats.total} scenarios`,
};
