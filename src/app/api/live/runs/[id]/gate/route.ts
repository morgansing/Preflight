import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { compareRuns, resolveBaselineRun } from "@/server/regression";

export const dynamic = "force-dynamic";

/**
 * The CI gate: one aggregate answer a build can act on. Poll while the
 * run executes; once complete the response carries pass/fail against
 * ?minScore= and ?maxRegressions=. Run errors never fail the gate by
 * default (amber is infra, not the agent) — cap them explicitly with
 * ?maxRunErrors= if a flaky endpoint should block the build too.
 */

interface GateCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
  const { id } = await params;
  const run = await prisma.liveRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const q = request.nextUrl.searchParams;
  const minScore = numParam(q.get("minScore"));
  const maxRegressions = numParam(q.get("maxRegressions"));
  const maxRunErrors = numParam(q.get("maxRunErrors"));

  const grouped = await prisma.liveResult.groupBy({
    by: ["outcome"],
    _count: { _all: true },
    where: { runId: id },
  });
  const counts = { pass: 0, fail: 0, partial: 0, error: 0 };
  for (const g of grouped) {
    if (g.outcome in counts) counts[g.outcome as keyof typeof counts] = g._count._all;
  }
  const scored = counts.pass + counts.fail + counts.partial;
  const score = scored ? Math.round((counts.pass / scored) * 100) : 0;
  const total = (JSON.parse(run.scenariosJson) as string[]).length;

  if (run.status === "running") {
    return NextResponse.json({
      runId: id,
      status: "running",
      completed: scored + counts.error,
      total,
      score,
      counts,
    });
  }

  const checks: GateCheck[] = [];
  checks.push({
    name: "run completed",
    ok: run.status === "complete",
    detail: run.status === "complete" ? "complete" : `run ${run.status}: ${run.error ?? "unknown error"}`,
  });

  if (minScore !== undefined) {
    checks.push({
      name: `score ≥ ${minScore}`,
      ok: score >= minScore,
      detail: `scored ${score}% (${counts.pass}/${scored} passed; ${counts.error} run errors excluded)`,
    });
  }

  let regressionCount: number | undefined;
  let baselineRunId: string | undefined;
  if (maxRegressions !== undefined && run.status === "complete") {
    const baseline = await resolveBaselineRun(prisma, run);
    if (baseline) {
      const report = await compareRuns(prisma, baseline, run.id);
      regressionCount = report.regressions.length;
      baselineRunId = baseline.id;
      checks.push({
        name: `regressions ≤ ${maxRegressions}`,
        ok: report.regressions.length <= maxRegressions,
        detail:
          `${report.regressions.length} regressed, ${report.improvements.length} recovered ` +
          `vs ${baseline.pinned ? "pinned baseline" : "previous run"} ${baseline.id} ` +
          `(${report.baselineScore}% → ${report.candidateScore}%)`,
      });
    } else {
      checks.push({
        name: `regressions ≤ ${maxRegressions}`,
        ok: true,
        detail: "no baseline to compare against — check skipped (first run of this agent + suite)",
      });
    }
  }

  if (maxRunErrors !== undefined) {
    checks.push({
      name: `run errors ≤ ${maxRunErrors}`,
      ok: counts.error <= maxRunErrors,
      detail: `${counts.error} scenarios hit infra errors`,
    });
  }

  return NextResponse.json({
    runId: id,
    status: run.status,
    pass: checks.every((c) => c.ok),
    checks,
    score,
    counts,
    total,
    regressionCount,
    baselineRunId,
  });
  } catch (err) {
    return NextResponse.json(routeError("live.gate", err), { status: 500 });
  }
}

function numParam(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
