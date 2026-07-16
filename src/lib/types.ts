export type Outcome = "pass" | "fail" | "partial";
export type Severity = "critical" | "high" | "medium" | "low";

export interface Scenario {
  id: string; // "SCN-0142"
  name: string;
  category: string;
  severity: Severity;
  rubric: string; // one-line correct-outcome
  persona: string;
  openingMessage: string;
  hiddenFacts: string[];
  passCriteria: string[];
  mustNot: string[];
}

/** One cell on the Mission Control wall. */
export interface RunCell {
  scenarioId: string;
  outcome: Outcome;
  startAt: number; // ms offset into the run when it begins executing
  resolveAt: number; // ms offset when it settles
  tokens: number;
  costUsd: number;
  latencyMs: number;
  failureReason?: string;
}

export interface Run {
  id: string;
  agent: string;
  agentVersion: string;
  suite: string;
  startedAt: string;
  durationMs: number;
  cells: RunCell[];
}

export interface ReplayStep {
  actor: "customer" | "agent" | "tool";
  kind: "message" | "tool_call" | "tool_result" | "reasoning";
  label?: string; // tool name for calls/results
  content: string; // message text, reasoning, or pretty-printed JSON
}

export interface ExpectedStep {
  text: string;
  kind: "must" | "must_not";
}

/** A transcript quote backing one criterion of the judge's verdict. */
export interface JudgeEvidence {
  criterion: string;
  quote: string;
  /** 0-based index into steps. */
  step: number;
}

export interface Replay {
  scenarioId: string;
  outcome: Outcome;
  severity: Severity;
  tokens: number;
  costUsd: number;
  latencyMs: number;
  steps: ReplayStep[];
  expectedPath: ExpectedStep[];
  /** Index into steps where the agent left the correct path. */
  divergenceStep?: number;
  /** Index into expectedPath that was violated at that moment. */
  divergenceExpected?: number;
  failureReason?: string;
  /** Judge verdict detail — live runs only; demo replays omit these. */
  criteriaMet?: string[];
  criteriaViolated?: string[];
  evidence?: JudgeEvidence[];
}

export interface AgentUnderTest {
  id: string;
  name: string;
  version: string;
  connection: "HTTP endpoint" | "MCP endpoint" | "Reference agent";
  threshold: number; // deployment threshold, e.g. 90
  scoreHistory: number[]; // oldest → newest
  lastRun: {
    runId: string;
    passed: number;
    total: number;
    critical: number;
    agoLabel: string;
  };
  /** One-line summary of where the agent stands — shown faint under the
   * connection/pass line on the dashboard. */
  note?: string;
  /** Per-category pass/total for the agent detail page. */
  breakdown?: { category: string; pass: number; total: number }[];
}

export function verdictFor(score: number): string {
  if (score >= 90) return "Ready to ship";
  if (score >= 75) return "Nearly ready";
  return "Not ready";
}
