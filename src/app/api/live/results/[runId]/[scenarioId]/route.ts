import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { ownerWhere, requireUser } from "@/server/auth";
import type { LiveReplayPayload, ScenarioSnapshot } from "@/lib/live-types";
import type { Scenario } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; scenarioId: string }> },
) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const { runId, scenarioId } = await params;
  const result = await prisma.liveResult.findUnique({
    where: { runId_scenarioId: { runId, scenarioId } },
    include: { run: { select: { ownerId: true } } },
  });
  const scope = ownerWhere(auth.user);
  if (!result || (scope.ownerId && result.run.ownerId !== scope.ownerId)) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const judge = result.judgeJson ? JSON.parse(result.judgeJson) : null;
  let snapshot: ScenarioSnapshot | undefined;
  if (result.scenarioJson) {
    const s = JSON.parse(result.scenarioJson) as Scenario;
    snapshot = {
      name: s.name,
      category: s.category,
      rubric: s.rubric,
      passCriteria: s.passCriteria,
      mustNot: s.mustNot,
    };
  }
  const payload: LiveReplayPayload = {
    scenarioId,
    runId,
    outcome: result.outcome as LiveReplayPayload["outcome"],
    severity: result.severity as LiveReplayPayload["severity"],
    tokens: result.tokens,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    steps: JSON.parse(result.transcriptJson),
    failureReason: result.failureReason ?? undefined,
    divergenceStep: result.divergenceStep ?? undefined,
    divergenceExpected: result.divergenceExpected ?? undefined,
    criteriaMet: judge?.criteriaMet,
    criteriaViolated: judge?.criteriaViolated,
    evidence: judge?.evidence,
    snapshot,
  };
  return NextResponse.json(payload);
}
