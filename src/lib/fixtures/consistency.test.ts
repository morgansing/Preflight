import { describe, expect, it } from "vitest";
import { demoAgents } from "./agents";
import { categoryComparison, demoBenchmark } from "./benchmark";
import {
  demoOutcomes,
  failingReplayId,
  categories,
  gauntletScenarioIds,
  scenarios,
  scenarioById,
  getSuite,
} from "./scenarios";
import { demoReport } from "./report";
import { getReplay, featuredFailures } from "./replays";
import { demoRun, readiness, runStats } from "./run";
import { categoryResults, latestRunOutcomes, pastRuns, runOutcomes, runsByAgent } from "./runs";
import { difficultyOf, pressureVectors } from "@/lib/scenario-generation";
import { suiteScenarioIds } from "@/server/suite";

/**
 * The demo is a web of cross-fixture contracts: the wall, the agents,
 * the benchmark, the report and the run history all describe the same
 * fictional world. These tests pin that world so a copy tweak or a new
 * fixture can't silently contradict it.
 */

// Hand-authored "risk story" replays the report features even though the
// wall counts their scenarios as passes. Kept deliberately — the report
// treats them as observed behaviours; the run wall's budget stays 193/5/2.
const RISK_STORY_EXCEPTIONS = new Set(["SCN-0184", "SCN-0194"]);

describe("scenario suite", () => {
  it("has the fixed outcome budget (193 pass · 5 fail · 2 partial → 97%)", () => {
    const counts = { pass: 0, fail: 0, partial: 0 };
    for (const o of demoOutcomes.values()) counts[o] += 1;
    expect(scenarios).toHaveLength(200);
    expect(counts).toEqual({ pass: 193, fail: 5, partial: 2 });
    expect(runStats.score).toBe(97);
    expect(readiness.score).toBe(97);
  });

  it("extends deterministically — smaller suites are prefixes of larger ones", () => {
    const s500 = getSuite(500);
    const s1000 = getSuite(1000);
    expect(s1000.slice(0, 500).map((s) => s.id)).toEqual(s500.map((s) => s.id));
  });

  it("failingReplayId always lands on a non-passing replay", () => {
    const linked: string[] = [];
    for (const c of categories) {
      const id = failingReplayId(c);
      if (!id) continue;
      linked.push(c);
      expect(getReplay(id)?.outcome, `${c} → ${id}`).not.toBe("pass");
    }
    expect(linked.sort()).toEqual(
      ["Duplicate orders", "Escalations", "Refund fraud", "Returns & exchanges"].sort(),
    );
  });
});

describe("difficulty", () => {
  it("grades every scenario 1–5 with a real spread", () => {
    const byLevel = new Map<number, number>();
    for (const s of getSuite(1000)) {
      expect(s.difficulty, s.id).toBeGreaterThanOrEqual(1);
      expect(s.difficulty, s.id).toBeLessThanOrEqual(5);
      byLevel.set(s.difficulty, (byLevel.get(s.difficulty) ?? 0) + 1);
    }
    // A pyramid, not a monoculture: plenty of routine, a real brutal tail.
    expect(byLevel.get(1) ?? 0).toBeGreaterThan(50);
    expect((byLevel.get(4) ?? 0) + (byLevel.get(5) ?? 0)).toBeGreaterThanOrEqual(20);
  });

  it("the demo agent only misses hard scenarios — the 97% is earned on the easy ones", () => {
    for (const [id, o] of demoOutcomes) {
      if (o === "fail") {
        expect(scenarioById.get(id)!.difficulty, id).toBeGreaterThanOrEqual(4);
      } else if (o === "partial") {
        expect(scenarioById.get(id)!.difficulty, id).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("the gauntlet is exactly the difficulty 4–5 slice of the base suite", () => {
    expect(gauntletScenarioIds.length).toBeGreaterThanOrEqual(20);
    for (const id of gauntletScenarioIds) {
      expect(scenarioById.get(id)!.difficulty, id).toBeGreaterThanOrEqual(4);
    }
    // Every demo fail is in the gauntlet — the hard slice contains the traps.
    for (const [id, o] of demoOutcomes) {
      if (o === "fail") expect(gauntletScenarioIds, id).toContain(id);
    }
    expect(suiteScenarioIds("gauntlet")).toEqual(gauntletScenarioIds);
  });

  it("generated pressure ladders span control → brutal", () => {
    const rule = {
      text: "Refunds over £500 require human review",
      category: "Refunds",
      severity: "critical" as const,
      kind: "must" as const,
      source: "document" as const,
    };
    const rungs = pressureVectors(rule, 6, "low");
    expect(rungs).toHaveLength(6);
    const levels = rungs.map(difficultyOf);
    expect(Math.min(...levels)).toBeLessThanOrEqual(2); // the honest control
    expect(Math.max(...levels)).toBe(5); // the expert adversary
    for (const l of levels) {
      expect(l).toBeGreaterThanOrEqual(1);
      expect(l).toBeLessThanOrEqual(5);
    }
  });
});

describe("replays", () => {
  it("exist for every base scenario and match the wall outcome (documented exceptions aside)", () => {
    for (const s of scenarios) {
      const replay = getReplay(s.id);
      expect(replay, s.id).toBeTruthy();
      if (RISK_STORY_EXCEPTIONS.has(s.id)) {
        expect(demoOutcomes.get(s.id)).toBe("pass");
        expect(replay!.outcome).toBe("fail");
      } else {
        expect(replay!.outcome, s.id).toBe(demoOutcomes.get(s.id));
      }
    }
  });

  it("keeps every featured failure a genuine failure", () => {
    for (const id of featuredFailures) {
      expect(getReplay(id)?.outcome, id).toBe("fail");
    }
  });

  it("every miss carries a full diagnosis; passes carry none", () => {
    for (const s of scenarios) {
      const replay = getReplay(s.id)!;
      if (replay.outcome === "pass") {
        expect(replay.diagnosis, s.id).toBeUndefined();
      } else {
        const d = replay.diagnosis;
        expect(d, s.id).toBeTruthy();
        expect(d!.rootCause.length, s.id).toBeGreaterThan(20);
        expect(d!.impact.length, s.id).toBeGreaterThan(20);
        expect(d!.fix.length, s.id).toBeGreaterThan(20);
        expect(d!.confidence, s.id).toBeGreaterThan(0.5);
        expect(d!.confidence, s.id).toBeLessThanOrEqual(1);
      }
    }
    // The featured six have hand-written diagnoses with high confidence.
    for (const id of featuredFailures) {
      expect(getReplay(id)!.diagnosis!.confidence, id).toBeGreaterThanOrEqual(0.97);
    }
  });
});

describe("report", () => {
  it("links every risk to a failing replay", () => {
    for (const risk of demoReport.risks) {
      expect(getReplay(risk.replayId)?.outcome, risk.title).toBe("fail");
    }
  });

  it("taxonomy fail counts match the wall per category", () => {
    const failsByCategory = new Map<string, number>();
    for (const [id, o] of demoOutcomes) {
      if (o !== "fail") continue;
      const cat = scenarioById.get(id)!.category;
      failsByCategory.set(cat, (failsByCategory.get(cat) ?? 0) + 1);
    }
    const expected = [
      { category: "Refund fraud", total: 12 },
      { category: "Duplicate orders", total: 9 },
      { category: "Escalations", total: 8 },
    ];
    demoReport.taxonomy.forEach((t, i) => {
      expect(t.failed, t.finding).toBe(failsByCategory.get(expected[i].category));
      expect(t.total, t.finding).toBe(expected[i].total);
    });
  });
});

describe("agents", () => {
  it("breakdowns sum to the passed count; scores match", () => {
    for (const a of demoAgents) {
      const sum = (a.breakdown ?? []).reduce((n, b) => n + b.pass, 0);
      expect(sum, a.id).toBe(a.lastRun.passed);
      const last = a.scoreHistory[a.scoreHistory.length - 1];
      expect(Math.round((a.lastRun.passed / a.lastRun.total) * 100), a.id).toBe(last);
    }
  });
});

describe("benchmark", () => {
  it("v1.3's wall agrees with the newly-passing and newly-broken lists", () => {
    for (const e of demoBenchmark.newlyPassing) {
      expect(demoOutcomes.get(e.scenarioId), `newly passing ${e.scenarioId}`).toBe("pass");
    }
    for (const e of demoBenchmark.newlyBroken) {
      expect(demoOutcomes.get(e.scenarioId), `newly broken ${e.scenarioId}`).toBe("fail");
    }
    for (const e of demoBenchmark.unchangedFails) {
      expect(demoOutcomes.get(e.scenarioId), `unchanged ${e.scenarioId}`).toBe("fail");
    }
  });

  it("categoryComparison sums to both runs' pass counts", () => {
    expect(categoryComparison.reduce((s, c) => s + c.aPass, 0)).toBe(168);
    expect(categoryComparison.reduce((s, c) => s + c.bPass, 0)).toBe(193);
    expect(categoryComparison.reduce((s, c) => s + c.regressions, 0)).toBe(
      demoBenchmark.newlyBroken.length,
    );
  });
});

describe("run history", () => {
  it("is 30 unique runs, newest first", () => {
    expect(pastRuns).toHaveLength(30);
    expect(new Set(pastRuns.map((r) => r.id)).size).toBe(30);
    const nums = pastRuns.map((r) => parseInt(r.id.slice(4), 10));
    expect([...nums].sort((a, b) => b - a)).toEqual(nums);
  });

  it("every run's outcomes reconcile with its counts", () => {
    for (const r of pastRuns) {
      const outcomes = runOutcomes(r.id)!;
      expect(outcomes.size, r.id).toBe(200);
      let pass = 0,
        fail = 0,
        partial = 0,
        critical = 0;
      for (const [id, o] of outcomes) {
        if (o === "pass") pass += 1;
        else if (o === "fail") {
          fail += 1;
          if (scenarioById.get(id)!.severity === "critical") critical += 1;
        } else partial += 1;
      }
      expect({ pass, fail, partial, critical }, r.id).toEqual({
        pass: r.passed,
        fail: r.failed,
        partial: r.partial,
        critical: r.critical,
      });
      expect(Math.round((r.passed / r.total) * 100), r.id).toBe(r.score);
    }
  });

  it("each agent's latest run IS its fixture lastRun + breakdown", () => {
    for (const a of demoAgents) {
      const latest = runsByAgent.get(a.id)![0];
      expect(latest.id, a.id).toBe(a.lastRun.runId);
      expect(latest.passed, a.id).toBe(a.lastRun.passed);
      expect(latest.critical, a.id).toBe(a.lastRun.critical);
      expect(latest.label, a.id).toBe(a.lastRun.agoLabel);
      expect(latestRunOutcomes(a.id), a.id).toBe(runOutcomes(latest.id));
      const cats = categoryResults(latest.id);
      for (const b of a.breakdown ?? []) {
        const c = cats.find((x) => x.category === b.category)!;
        expect({ pass: c.pass, total: c.total }, `${a.id}/${b.category}`).toEqual({
          pass: b.pass,
          total: b.total,
        });
      }
    }
  });

  it("the latest Aurora run is the demo run, byte for byte", () => {
    expect(runOutcomes("run_0147")).toBe(demoOutcomes);
    expect(demoRun.id).toBe("run_0147");
  });

  it("run_0139 honours the benchmark contract", () => {
    const v12 = runOutcomes("run_0139")!;
    for (const e of demoBenchmark.newlyPassing) {
      expect(v12.get(e.scenarioId), `v1.2 fails ${e.scenarioId}`).toBe("fail");
    }
    for (const e of demoBenchmark.unchangedFails) {
      expect(v12.get(e.scenarioId), `v1.2 misses ${e.scenarioId}`).not.toBe("pass");
    }
    for (const e of demoBenchmark.newlyBroken) {
      expect(v12.get(e.scenarioId), `v1.2 passes ${e.scenarioId}`).toBe("pass");
    }
  });

  it("misses nest over an agent's history — what a later run fixed stays fixed looking back", () => {
    const latestMisses = [...demoOutcomes.entries()]
      .filter(([, o]) => o !== "pass")
      .map(([id]) => id);
    for (const r of runsByAgent.get("agent_aurora")!.slice(1)) {
      const outcomes = runOutcomes(r.id)!;
      for (const id of latestMisses) {
        expect(outcomes.get(id), `${r.id} should still miss ${id}`).not.toBe("pass");
      }
    }
  });
});
