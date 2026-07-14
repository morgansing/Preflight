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
  suite: "smoke" | "full";
  status: "running" | "complete" | "error";
  error?: string;
  startedAt: string;
  finishedAt?: string;
  scenarioIds: string[];
  results: LiveCellResult[];
}

export type LiveEvent =
  | { type: "scenario_started"; scenarioId: string }
  | { type: "scenario_finished"; result: LiveCellResult }
  | { type: "run_finished"; status: "complete" | "error"; error?: string };

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
}

export function scoreOf(results: LiveCellResult[]): number {
  const scored = results.filter((r) => r.outcome !== "error");
  if (scored.length === 0) return 0;
  return Math.round(
    (scored.filter((r) => r.outcome === "pass").length / scored.length) * 100,
  );
}
