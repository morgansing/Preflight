import type { PrismaClient } from "@prisma/client";
import type { ClusterReport, FailureCluster } from "@/lib/live-types";
import type { Severity } from "@/lib/types";
import type { ClusterDraft, Provider } from "./provider";

/**
 * Failure clustering: turn a wall of red into a diagnosis. Failures are
 * first grouped canonically by the rubric criterion the judge said was
 * violated (falling back to the failure reason), then the provider
 * names each group as a root cause and merges duplicates. Without a
 * provider — or if naming fails — deterministic labels are used and the
 * report says so: the grouping is always honest, only the prose varies.
 */

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface FailRow {
  scenarioId: string;
  name?: string;
  category: string;
  severity: Severity;
  outcome: "fail" | "partial";
  reason: string;
  violated: string[];
}

/** Canonical key: normalized violated criterion (or failure reason). */
function keyOf(row: FailRow): string {
  const basis = row.violated[0] ?? row.reason;
  return basis
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function getClusterReport(
  prisma: PrismaClient,
  runId: string,
  provider: Provider | null,
): Promise<ClusterReport> {
  const results = await prisma.liveResult.findMany({
    where: { runId, outcome: { in: ["fail", "partial"] } },
    select: {
      scenarioId: true,
      scenarioName: true,
      scenarioCategory: true,
      severity: true,
      outcome: true,
      failureReason: true,
      judgeJson: true,
    },
  });

  const rows: FailRow[] = results.map((r) => {
    const judge = r.judgeJson
      ? (JSON.parse(r.judgeJson) as { criteriaViolated?: string[] })
      : null;
    return {
      scenarioId: r.scenarioId,
      name: r.scenarioName ?? undefined,
      category: r.scenarioCategory ?? "Other",
      severity: r.severity as Severity,
      outcome: r.outcome as "fail" | "partial",
      reason: r.failureReason ?? "Unspecified failure",
      violated: judge?.criteriaViolated ?? [],
    };
  });

  // 1 — canonical grouping.
  const groups = new Map<string, FailRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const drafts = [...groups.values()].sort((a, b) => b.length - a.length);

  // 2 — naming (provider model, or labeled deterministic fallback).
  let method: ClusterReport["method"] = "heuristic";
  let namings = drafts.map((g, i) => heuristicNaming(i, g));
  if (provider?.nameClusters && drafts.length > 0) {
    try {
      const draftInput: ClusterDraft[] = drafts.map((g, i) => ({
        index: i,
        count: g.length,
        sampleReasons: [...new Set(g.map((r) => r.reason))].slice(0, 3),
        sampleScenarios: g.slice(0, 5).map((r) => r.name ?? r.scenarioId),
        categories: [...new Set(g.map((r) => r.category))],
      }));
      const named = await provider.nameClusters(draftInput);
      const byIndex = new Map(named.map((n) => [n.index, n]));
      if (byIndex.size > 0) {
        namings = drafts.map(
          (g, i) => byIndex.get(i) ?? heuristicNaming(i, g),
        );
        method = "llm";
      }
    } catch (err) {
      console.error(`[preflight] cluster naming failed, using heuristic labels:`, err);
    }
  }

  // 3 — apply merges, then assemble.
  const memberLists: FailRow[][] = drafts.map((g) => [...g]);
  for (let i = 0; i < namings.length; i++) {
    const target = namings[i].mergeInto;
    if (target >= 0 && target !== i && target < memberLists.length) {
      memberLists[target].push(...memberLists[i]);
      memberLists[i] = [];
    }
  }

  const clusters: FailureCluster[] = [];
  for (let i = 0; i < memberLists.length; i++) {
    const members = memberLists[i];
    if (members.length === 0) continue;
    const naming = namings[i];
    members.sort(
      (a, b) => (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4),
    );
    clusters.push({
      id: `cl_${i}`,
      title: naming.title,
      rootCause: naming.rootCause,
      fix: naming.fix,
      severity: members[0].severity,
      count: members.length,
      categories: [...new Set(members.map((m) => m.category))],
      members: members.map((m) => ({
        scenarioId: m.scenarioId,
        name: m.name,
        outcome: m.outcome,
      })),
      sampleReason: members[0].reason,
    });
  }
  clusters.sort(
    (a, b) =>
      (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4) || b.count - a.count,
  );

  return {
    method,
    provider: provider?.name ?? "mock",
    clusters,
    failures: rows.length,
    generatedAt: new Date().toISOString(),
  };
}

/** Deterministic naming: honest, labeled, no fake insight. */
function heuristicNaming(index: number, group: FailRow[]) {
  const basis = group[0].violated[0] ?? group[0].reason;
  const title = basis.length > 90 ? `${basis.slice(0, 87)}…` : basis;
  return {
    index,
    title,
    rootCause:
      group.length > 1
        ? `${group.length} scenarios failed on the same rubric criterion, across ${new Set(group.map((g) => g.category)).size} categor${new Set(group.map((g) => g.category)).size === 1 ? "y" : "ies"}. Judge's reading: ${group[0].reason}`
        : `Judge's reading: ${group[0].reason}`,
    fix: "Review the linked replays for the shared divergence pattern.",
    mergeInto: -1,
  };
}
