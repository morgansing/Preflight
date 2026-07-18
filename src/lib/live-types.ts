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
  status: "queued" | "running" | "complete" | "error";
  error?: string;
  startedAt: string;
  finishedAt?: string;
  scenarioIds: string[];
  results: LiveCellResult[];
  /** Present when this run is one step of a flight plan. */
  planId?: string;
  planKind?: string;
  planStep?: number;
}

/** Lightweight run listing — aggregates only, no per-scenario results.
 * A Max-tier run has 10,000 results; lists must not carry them. */
export interface LiveRunListItem {
  id: string;
  agentName: string;
  agentKind: string;
  provider: "anthropic" | "mock";
  suite: string;
  status: "queued" | "running" | "complete" | "error";
  error?: string;
  startedAt: string;
  finishedAt?: string;
  total: number;
  counts: { pass: number; fail: number; partial: number; error: number };
  score: number;
  planId?: string;
  planKind?: string;
}

/** A flight plan: several runs launched as one job, executed
 * sequentially against the shared store. */
export interface LivePlan {
  planId: string;
  planKind: string;
  agentName: string;
  runs: LiveRunListItem[];
  /** complete = every step finished (errors included — a failed step
   * doesn't block the next). */
  done: boolean;
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
  /** The judge's transcript quotes — its work, shown. */
  evidence?: JudgeEvidenceItem[];
  /** Present for generated custom scenarios; base scenarios resolve via id. */
  snapshot?: ScenarioSnapshot;
}

/** A quoted transcript line backing one criterion of the judge's verdict. */
export interface JudgeEvidenceItem {
  criterion: string;
  quote: string;
  /** 0-based index into the replay steps. */
  step: number;
}

/** One root-cause group of failures — the diagnosis, not the list. */
export interface FailureCluster {
  id: string;
  /** The behaviour, e.g. "Refunds under emotional pressure despite contradicting evidence". */
  title: string;
  rootCause: string;
  fix: string;
  /** Highest severity among members. */
  severity: Severity;
  count: number;
  categories: string[];
  members: Array<{ scenarioId: string; name?: string; outcome: "fail" | "partial" }>;
  sampleReason: string;
}

export interface ClusterReport {
  /** "llm" = named by the provider model; "heuristic" = deterministic labels. */
  method: "llm" | "heuristic";
  provider: "anthropic" | "mock";
  clusters: FailureCluster[];
  failures: number;
  generatedAt: string;
}

/** One scenario whose outcome changed between the baseline and this run. */
export interface ScenarioDelta {
  scenarioId: string;
  name?: string;
  category?: string;
  severity: Severity;
  from: LiveOutcome;
  to: LiveOutcome;
  /** The candidate run's failure reason, when it failed. */
  failureReason?: string;
}

/**
 * A run compared against its baseline. Run errors (infra) are excluded
 * from the comparison on either side — an endpoint timeout is never a
 * regression, matching the amber-not-red rule everywhere else.
 */
export interface RegressionReport {
  baselineRunId: string;
  baselineStartedAt: string;
  /** true = explicitly pinned; false = previous run of same agent+suite. */
  baselinePinned: boolean;
  candidateRunId: string;
  baselineScore: number;
  candidateScore: number;
  /** Outcome got worse: pass→partial, pass→fail, partial→fail. */
  regressions: ScenarioDelta[];
  /** Outcome got better. */
  improvements: ScenarioDelta[];
  stillFailing: number;
  stillPassing: number;
  /** Scenario pairs excluded because either side was a run error. */
  excludedErrors: number;
  /** Scenarios present in only one run (suite drifted between runs). */
  onlyInBaseline: number;
  onlyInCandidate: number;
}

export function scoreOf(results: LiveCellResult[]): number {
  const scored = results.filter((r) => r.outcome !== "error");
  if (scored.length === 0) return 0;
  return Math.round(
    (scored.filter((r) => r.outcome === "pass").length / scored.length) * 100,
  );
}
