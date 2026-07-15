import type { Outcome, ReplayStep, Severity } from "./types";

/**
 * Shared client/server types for Live mode. Live adds one outcome the
 * demo never needs: "error" — an infra failure (endpoint timeout, API
 * error). It renders amber, never red: red stays reserved for genuine
 * agent failures so it stays trustworthy.
 */
export type LiveOutcome = Outcome | "error";

export interface LiveCellResult {
  scenarioId: string;
  // Snapshot fields — present for generated custom scenarios (whose ids
  // aren't in the base library) and any run recorded with a snapshot.
  name?: string;
  category?: string;
  outcome: LiveOutcome;
  failureReason?: string;
  severity: Severity;
  tokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface LiveRunSummary {
  id: string;
  agentName: string;
  agentKind: string;
  provider: "anthropic" | "mock";
  suite: string; // tier id: smoke | standard | extended | scale | exhaustive | max
  status: "running" | "complete" | "error";
  error?: string;
  startedAt: string;
  finishedAt?: string;
  scenarioIds: string[];
  results: LiveCellResult[];
}

/** Lightweight run listing — aggregates only, no per-scenario results.
 * A Max-tier run has 10,000 results; lists must not carry them. */
export interface LiveRunListItem {
  id: string;
  agentName: string;
  agentKind: string;
  provider: "anthropic" | "mock";
  suite: string;
  status: "running" | "complete" | "error";
  error?: string;
  startedAt: string;
  finishedAt?: string;
  total: number;
  counts: { pass: number; fail: number; partial: number; error: number };
  score: number;
}

export type LiveEvent =
  | { type: "scenario_started"; scenarioId: string }
  | { type: "scenario_finished"; result: LiveCellResult }
  | { type: "run_finished"; status: "complete" | "error"; error?: string };

/** A scenario snapshot carried on results so replay/report never depend
 * on the (regenerable) suite still existing. */
export interface ScenarioSnapshot {
  name: string;
  category: string;
  rubric: string;
  passCriteria: string[];
  mustNot: string[];
}

export interface LiveReplayPayload {
  scenarioId: string;
  runId: string;
  outcome: LiveOutcome;
  severity: Severity;
  tokens: number;
  costUsd: number;
  latencyMs: number;
  steps: ReplayStep[];
  failureReason?: string;
  divergenceStep?: number;
  divergenceExpected?: number;
  criteriaMet?: string[];
  criteriaViolated?: string[];
  /** Present for generated custom scenarios; base scenarios resolve via id. */
  snapshot?: ScenarioSnapshot;
}

export function scoreOf(results: LiveCellResult[]): number {
  const scored = results.filter((r) => r.outcome !== "error");
  if (scored.length === 0) return 0;
  return Math.round(
    (scored.filter((r) => r.outcome === "pass").length / scored.length) * 100,
  );
}
