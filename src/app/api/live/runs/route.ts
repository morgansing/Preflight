import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { launchRun } from "@/server/harness";
import type { LiveRunListItem } from "@/lib/live-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await prisma.liveRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  const grouped = await prisma.liveResult.groupBy({
    by: ["runId", "outcome"],
    _count: { _all: true },
    where: { runId: { in: runs.map((r) => r.id) } },
  });

  const items: LiveRunListItem[] = runs.map((run) => {
    const counts = { pass: 0, fail: 0, partial: 0, error: 0 };
    for (const g of grouped) {
      if (g.runId === run.id && g.outcome in counts) {
        counts[g.outcome as keyof typeof counts] = g._count._all;
      }
    }
    const scored = counts.pass + counts.fail + counts.partial;
    return {
      id: run.id,
      agentName: run.agentName,
      agentKind: run.agentKind,
      provider: run.provider as "anthropic" | "mock",
      suite: run.suite,
      status: run.status as LiveRunListItem["status"],
      error: run.error ?? undefined,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      total: (JSON.parse(run.scenariosJson) as string[]).length,
      counts,
      score: scored ? Math.round((counts.pass / scored) * 100) : 0,
    };
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const agentKind = body.agentKind as string;
  if (!["reference", "http", "openai", "mcp"].includes(agentKind)) {
    return NextResponse.json({ error: "agentKind must be reference | http | openai | mcp" }, { status: 400 });
  }
  const result = await launchRun({
    agentName: String(body.agentName ?? "Reference agent"),
    agentKind: agentKind as "reference" | "http" | "openai" | "mcp",
    endpoint: body.endpoint ? String(body.endpoint) : undefined,
    model: body.model ? String(body.model) : undefined,
    authToken: body.authToken ? String(body.authToken) : undefined,
    systemPrompt: body.systemPrompt ? String(body.systemPrompt) : undefined,
    suite: String(body.suite ?? "smoke"),
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}
