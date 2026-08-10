import { prisma } from "./db";
import { suiteScenarioIds } from "./suite";
import { SECURITY_SUITE_SIZE } from "@/lib/suite-tiers";
import type { LiveRunListItem } from "@/lib/live-types";
import type { LiveRun } from "@prisma/client";

/** How many simulations a suite will run — for credit accounting. */
export async function plannedSimCount(suite: string, scenarioIds?: string[]): Promise<number> {
  if (suite === "regression") return scenarioIds?.length ?? 0;
  if (suite === "security") return SECURITY_SUITE_SIZE;
  const custom = suite.match(/^custom:(\d+)$/);
  if (custom) {
    const cs = await prisma.customSuite.findUnique({ where: { version: parseInt(custom[1], 10) } });
    return cs?.scenarioCount ?? 0;
  }
  return suiteScenarioIds(suite)?.length ?? 0;
}

/** Build lightweight list items (aggregate counts, no per-scenario
 * results) for a set of runs. Shared by the run list and plan routes. */
export async function toRunListItems(runs: LiveRun[]): Promise<LiveRunListItem[]> {
  const [grouped, costs] = await Promise.all([
    prisma.liveResult.groupBy({
      by: ["runId", "outcome"],
      _count: { _all: true },
      where: { runId: { in: runs.map((r) => r.id) } },
    }),
    prisma.liveResult.groupBy({
      by: ["runId"],
      _sum: { costUsd: true },
      where: { runId: { in: runs.map((r) => r.id) } },
    }),
  ]);
  const costBy = new Map(costs.map((c) => [c.runId, c._sum.costUsd ?? 0]));

  return runs.map((run) => {
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
      costUsd: +(costBy.get(run.id) ?? 0).toFixed(2),
      planId: run.planId ?? undefined,
      planKind: run.planKind ?? undefined,
    };
  });
}
