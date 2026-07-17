import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { routeError } from "@/server/log";
import { launchRun } from "@/server/harness";
import { suiteScenarioIds } from "@/server/suite";
import { checkFreeAllowance, recordFreeUsage } from "@/server/free-grant";
import { SECURITY_SUITE_SIZE } from "@/lib/suite-tiers";
import type { WorkspaceIdentity } from "@/lib/identity";
import type { LiveRunListItem } from "@/lib/live-types";

/** How many simulations a suite will run — for free-grant accounting. */
async function plannedSimCount(suite: string): Promise<number> {
  if (suite === "security") return SECURITY_SUITE_SIZE;
  const custom = suite.match(/^custom:(\d+)$/);
  if (custom) {
    const cs = await prisma.customSuite.findUnique({ where: { version: parseInt(custom[1], 10) } });
    return cs?.scenarioCount ?? 0;
  }
  return suiteScenarioIds(suite)?.length ?? 0;
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
  } catch (err) {
    return NextResponse.json(routeError("live.runs", err), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
  const body = await request.json().catch(() => ({}));
  const agentKind = body.agentKind as string;
  if (!["reference", "http", "openai", "mcp"].includes(agentKind)) {
    return NextResponse.json({ error: "agentKind must be reference | http | openai | mcp" }, { status: 400 });
  }
  const suite = String(body.suite ?? "smoke");
  const sandbox = body.sandbox === true;

  // Free-grant enforcement. The free tier's 250 simulations are metered
  // server-side against a normalized email + device fingerprint, so
  // cycling accounts can't farm fresh grants. Paid plans are unmetered.
  // Sandbox runs (mock, offline) never touch the grant.
  const plan = typeof body.plan === "string" ? body.plan : undefined;
  const identity = (body.identity ?? undefined) as WorkspaceIdentity | undefined;
  const identified = !!identity && (!!identity.email || !!identity.fingerprint);
  const sims = await plannedSimCount(suite);
  if (!sandbox && plan === "free" && identified) {
    const allow = await checkFreeAllowance(prisma, identity!);
    if (allow.blocked || sims > allow.remaining) {
      return NextResponse.json(
        {
          error: allow.blocked
            ? `Your ${allow.allowance} free simulations are used up. Add credits or start a plan to keep running.`
            : `This run needs ${sims} simulations but only ${allow.remaining} of your free ${allow.allowance} remain. Add credits or start a plan.`,
          remaining: allow.remaining,
          allowance: allow.allowance,
          freeGrantBlocked: true,
        },
        { status: 402 },
      );
    }
  }

  const result = await launchRun({
    agentName: String(body.agentName ?? "Reference agent"),
    agentKind: agentKind as "reference" | "http" | "openai" | "mcp",
    endpoint: body.endpoint ? String(body.endpoint) : undefined,
    model: body.model ? String(body.model) : undefined,
    authToken: body.authToken ? String(body.authToken) : undefined,
    systemPrompt: body.systemPrompt ? String(body.systemPrompt) : undefined,
    suite,
    sandbox,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  // Charge the free grant once the run is actually launched (never for
  // sandbox — those are free and offline).
  if (!sandbox && plan === "free" && identified) {
    await recordFreeUsage(prisma, identity!, sims);
  }
  return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(routeError("live.runs", err), { status: 500 });
  }
}
