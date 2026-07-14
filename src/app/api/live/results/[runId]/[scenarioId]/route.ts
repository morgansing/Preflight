import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import type { LiveReplayPayload } from "@/lib/live-types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string; scenarioId: string }> },
) {
  const { runId, scenarioId } = await params;
  const result = await prisma.liveResult.findUnique({
    where: { runId_scenarioId: { runId, scenarioId } },
  });
  if (!result) return NextResponse.json({ error: "Result not found" }, { status: 404 });

  const judge = result.judgeJson ? JSON.parse(result.judgeJson) : null;
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
  };
  return NextResponse.json(payload);
}
