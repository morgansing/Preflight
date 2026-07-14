import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { launchRun } from "@/server/harness";
import type { LiveRunSummary } from "@/lib/live-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await prisma.liveRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { results: true },
  });
  const summaries: LiveRunSummary[] = runs.map((run) => ({
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
    results: run.results.map((r) => ({
      scenarioId: r.scenarioId,
      outcome: r.outcome as LiveRunSummary["results"][number]["outcome"],
      failureReason: r.failureReason ?? undefined,
      severity: r.severity as LiveRunSummary["results"][number]["severity"],
      tokens: r.tokens,
      costUsd: r.costUsd,
      latencyMs: r.latencyMs,
    })),
  }));
  return NextResponse.json(summaries);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const agentKind = body.agentKind as string;
  if (!["reference", "http", "mcp"].includes(agentKind)) {
    return NextResponse.json({ error: "agentKind must be reference | http | mcp" }, { status: 400 });
  }
  const result = await launchRun({
    agentName: String(body.agentName ?? "Reference agent"),
    agentKind: agentKind as "reference" | "http" | "mcp",
    endpoint: body.endpoint ? String(body.endpoint) : undefined,
    suite: body.suite === "full" ? "full" : "smoke",
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}
