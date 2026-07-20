import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { ensureBootRecovery } from "@/server/harness";
import { ownerWhere, requireUser } from "@/server/auth";
import type { LiveRunSummary } from "@/lib/live-types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
  // First read after a restart resumes any interrupted run.
  void ensureBootRecovery();
  const { id } = await params;
  const run = await prisma.liveRun.findFirst({
    where: { id, ...ownerWhere(auth.user) },
    // Cheap columns only — transcript/judge JSON stays on the replay route.
    include: {
      results: {
    select: {
      scenarioId: true,
      scenarioName: true,
      scenarioCategory: true,
      outcome: true,
      failureReason: true,
      severity: true,
      tokens: true,
      costUsd: true,
      latencyMs: true,
    },
      },
    },
  });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const summary: LiveRunSummary = {
    id: run.id,
    agentName: run.agentName,
    agentKind: run.agentKind,
    provider: run.provider as "anthropic" | "mock",
    suite: run.suite as "smoke" | "full",
    status: run.status as LiveRunSummary["status"],
    error: run.error ?? undefined,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    scenarioIds: JSON.parse(run.scenariosJson),
    planId: run.planId ?? undefined,
    planKind: run.planKind ?? undefined,
    planStep: run.planStep ?? undefined,
    results: run.results.map((r) => ({
      scenarioId: r.scenarioId,
      name: r.scenarioName ?? undefined,
      category: r.scenarioCategory ?? undefined,
      outcome: r.outcome as LiveRunSummary["results"][number]["outcome"],
      failureReason: r.failureReason ?? undefined,
      severity: r.severity as LiveRunSummary["results"][number]["severity"],
      tokens: r.tokens,
      costUsd: r.costUsd,
      latencyMs: r.latencyMs,
    })),
  };
  return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(routeError("live.run", err), { status: 500 });
  }
}
