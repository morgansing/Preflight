import type { PrismaClient } from "@prisma/client";
import type {
  LiveOutcome,
  RegressionReport,
  ScenarioDelta,
} from "@/lib/live-types";
import type { Severity } from "@/lib/types";

/**
 * Regression comparison: this run versus its baseline. The baseline is
 * either explicitly pinned for (agentName, suite) — how CI keeps a
 * stable reference from the main branch — or, with no pin, the previous
 * completed run of the same agent + suite. Run errors are excluded from
 * the comparison on both sides: an endpoint timeout is never a
 * regression.
 */

const RANK: Record<string, number> = { pass: 2, partial: 1, fail: 0 };

interface ResultRow {
  scenarioId: string;
  scenarioName: string | null;
  outcome: string;
  severity: string;
  failureReason: string | null;
}

/** Find the run to compare `run` against, or null if there is none. */
export async function resolveBaselineRun(
  prisma: PrismaClient,
  run: { id: string; agentName: string; suite: string; startedAt: Date },
): Promise<{ id: string; startedAt: Date; pinned: boolean } | null> {
  const pin = await prisma.runBaseline.findUnique({
    where: { agentName_suite: { agentName: run.agentName, suite: run.suite } },
  });
  if (pin && pin.runId !== run.id) {
    const pinned = await prisma.liveRun.findUnique({ where: { id: pin.runId } });
    if (pinned && pinned.status === "complete") {
      return { id: pinned.id, startedAt: pinned.startedAt, pinned: true };
    }
  }
  const previous = await prisma.liveRun.findFirst({
    where: {
      agentName: run.agentName,
      suite: run.suite,
      status: "complete",
      id: { not: run.id },
      startedAt: { lt: run.startedAt },
    },
    orderBy: { startedAt: "desc" },
  });
  return previous
    ? { id: previous.id, startedAt: previous.startedAt, pinned: false }
    : null;
}

export async function compareRuns(
  prisma: PrismaClient,
  baseline: { id: string; startedAt: Date; pinned: boolean },
  candidateRunId: string,
): Promise<RegressionReport> {
  const select = {
    scenarioId: true,
    scenarioName: true,
    outcome: true,
    severity: true,
    failureReason: true,
  };
  const [baseRows, candRows] = await Promise.all([
    prisma.liveResult.findMany({ where: { runId: baseline.id }, select }),
    prisma.liveResult.findMany({ where: { runId: candidateRunId }, select }),
  ]);

  const baseBy = new Map(baseRows.map((r) => [r.scenarioId, r]));
  const regressions: ScenarioDelta[] = [];
  const improvements: ScenarioDelta[] = [];
  let stillFailing = 0;
  let stillPassing = 0;
  let excludedErrors = 0;
  let onlyInCandidate = 0;

  for (const cand of candRows) {
    const base = baseBy.get(cand.scenarioId);
    if (!base) {
      onlyInCandidate += 1;
      continue;
    }
    baseBy.delete(cand.scenarioId);
    if (base.outcome === "error" || cand.outcome === "error") {
      excludedErrors += 1;
      continue;
    }
    const from = RANK[base.outcome] ?? 0;
    const to = RANK[cand.outcome] ?? 0;
    if (to < from) regressions.push(toDelta(base, cand));
    else if (to > from) improvements.push(toDelta(base, cand));
    else if (cand.outcome === "pass") stillPassing += 1;
    else stillFailing += 1;
  }

  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const bySeverity = (a: ScenarioDelta, b: ScenarioDelta) =>
    (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
  regressions.sort(bySeverity);
  improvements.sort(bySeverity);

  return {
    baselineRunId: baseline.id,
    baselineStartedAt: baseline.startedAt.toISOString(),
    baselinePinned: baseline.pinned,
    candidateRunId,
    baselineScore: scoreRows(baseRows),
    candidateScore: scoreRows(candRows),
    regressions,
    improvements,
    stillFailing,
    stillPassing,
    excludedErrors,
    onlyInBaseline: baseBy.size,
    onlyInCandidate,
  };
}

function toDelta(base: ResultRow, cand: ResultRow): ScenarioDelta {
  return {
    scenarioId: cand.scenarioId,
    name: cand.scenarioName ?? base.scenarioName ?? undefined,
    severity: cand.severity as Severity,
    from: base.outcome as LiveOutcome,
    to: cand.outcome as LiveOutcome,
    failureReason: cand.failureReason ?? undefined,
  };
}

function scoreRows(rows: ResultRow[]): number {
  const scored = rows.filter((r) => r.outcome !== "error");
  if (scored.length === 0) return 0;
  return Math.round(
    (scored.filter((r) => r.outcome === "pass").length / scored.length) * 100,
  );
}
