import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { scoreOf } from "@/lib/live-types";
import type { LiveCellResult } from "@/lib/live-types";

/**
 * Public sharing: a run can mint one unguessable token that grants
 * read-only access to its score badge and a trimmed report — never
 * transcripts, never the workspace. Idempotent: one token per run.
 */

export async function ensureShareToken(runId: string): Promise<string | null> {
  const run = await prisma.liveRun.findUnique({
    where: { id: runId },
    select: { shareToken: true, status: true },
  });
  if (!run || run.status !== "complete") return null;
  if (run.shareToken) return run.shareToken;
  const token = randomBytes(16).toString("hex");
  await prisma.liveRun.update({ where: { id: runId }, data: { shareToken: token } });
  return token;
}

export interface SharedReport {
  agentName: string;
  suite: string;
  scenarioCount: number;
  score: number;
  startedAt: string;
  counts: { pass: number; fail: number; partial: number; error: number };
  categories: { category: string; pass: number; total: number }[];
  outcomes: { scenarioId: string; outcome: LiveCellResult["outcome"] }[];
}

/** The public read-only view of a shared run. Null = bad token. */
export async function sharedReport(token: string): Promise<SharedReport | null> {
  const run = await prisma.liveRun.findFirst({
    where: { shareToken: token, status: "complete" },
    include: {
      results: {
        select: { scenarioId: true, scenarioCategory: true, outcome: true },
      },
    },
  });
  if (!run) return null;

  const counts = { pass: 0, fail: 0, partial: 0, error: 0 };
  const byCategory = new Map<string, { pass: number; total: number }>();
  for (const r of run.results) {
    if (r.outcome in counts) counts[r.outcome as keyof typeof counts]++;
    if (r.outcome === "error") continue;
    const cat = r.scenarioCategory ?? "Other";
    const c = byCategory.get(cat) ?? { pass: 0, total: 0 };
    c.total += 1;
    if (r.outcome === "pass") c.pass += 1;
    byCategory.set(cat, c);
  }
  const scored = counts.pass + counts.fail + counts.partial;

  return {
    agentName: run.agentName,
    suite: run.suite,
    scenarioCount: (JSON.parse(run.scenariosJson) as string[]).length,
    score: scored ? Math.round((counts.pass / scored) * 100) : 0,
    startedAt: run.startedAt.toISOString(),
    counts,
    categories: [...byCategory.entries()]
      .map(([category, c]) => ({ category, ...c }))
      .sort((a, b) => a.pass / a.total - b.pass / b.total),
    outcomes: run.results.map((r) => ({
      scenarioId: r.scenarioId,
      outcome: r.outcome as LiveCellResult["outcome"],
    })),
  };
}

/** Score for the badge — demo token shows the fixture world's number. */
export async function badgeData(
  token: string,
): Promise<{ score: number; agentName: string } | null> {
  if (token === "demo") return { score: 97, agentName: "Aurora Support" };
  const run = await prisma.liveRun.findFirst({
    where: { shareToken: token, status: "complete" },
    select: { id: true, agentName: true },
  });
  if (!run) return null;
  const grouped = await prisma.liveResult.groupBy({
    by: ["outcome"],
    _count: { _all: true },
    where: { runId: run.id },
  });
  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.outcome] = g._count._all;
  const scored = (counts.pass ?? 0) + (counts.fail ?? 0) + (counts.partial ?? 0);
  return {
    score: scored ? Math.round(((counts.pass ?? 0) / scored) * 100) : 0,
    agentName: run.agentName,
  };
}

export { scoreOf };
