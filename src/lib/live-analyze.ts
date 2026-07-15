import { getScenarioById } from "./fixtures/scenarios";
import type { LiveRunSummary } from "./live-types";

export interface CategoryStat {
  name: string;
  pass: number;
  fail: number;
  partial: number;
  total: number;
}

export function categoryBreakdown(run: LiveRunSummary): CategoryStat[] {
  const byCategory = new Map<string, CategoryStat>();
  for (const r of run.results) {
    if (r.outcome === "error") continue;
    const name = r.category ?? getScenarioById(r.scenarioId)?.category ?? "Other";
    const c = byCategory.get(name) ?? { name, pass: 0, fail: 0, partial: 0, total: 0 };
    c.total += 1;
    if (r.outcome === "pass") c.pass += 1;
    else if (r.outcome === "fail") c.fail += 1;
    else c.partial += 1;
    byCategory.set(name, c);
  }
  return [...byCategory.values()];
}

export function strengthsAndWeaknesses(run: LiveRunSummary): {
  strengths: string[];
  weaknesses: string[];
} {
  const cats = categoryBreakdown(run);
  return {
    strengths: cats
      .filter((c) => c.fail === 0 && c.partial === 0)
      .sort((a, b) => b.total - a.total)
      .map((c) => c.name),
    weaknesses: cats
      .filter((c) => c.fail > 0)
      .sort((a, b) => b.fail / b.total - a.fail / a.total)
      .map((c) => c.name),
  };
}
