import { describe, expect, it } from "vitest";
import {
  buildCells,
  buildSessionRun,
  canLinkReplay,
  demoSuites,
  nextRunId,
  toPastRun,
} from "./demo-runs";
import { demoAgents } from "./fixtures/agents";
import { missOrder } from "./fixtures/runs";
import { scenarioById } from "./fixtures/scenarios";

describe("fake demo runs", () => {
  it("is deterministic per run id", () => {
    const a = buildSessionRun("agent_aurora", "smoke", "run_0148");
    const b = buildSessionRun("agent_aurora", "smoke", "run_0148");
    expect(a.outcomes).toEqual(b.outcomes);
    expect(buildCells(a)).toEqual(buildCells(b));
  });

  it("draws misses from the agent's canonical miss order (nesting holds)", () => {
    for (const agent of demoAgents) {
      for (const suite of demoSuites()) {
        const run = buildSessionRun(agent.id, suite.id, "run_0152");
        const inSuite = new Set(suite.scenarioIds);
        const missedByCategory = new Map<string, string[]>();
        for (const [sid, o] of Object.entries(run.outcomes)) {
          if (o === "pass") continue;
          const cat = scenarioById.get(sid)!.category;
          missedByCategory.set(cat, [...(missedByCategory.get(cat) ?? []), sid]);
        }
        for (const [cat, missed] of missedByCategory) {
          const order = missOrder(agent.id, cat).filter((sid) => inSuite.has(sid));
          // Misses are exactly a prefix of the canonical (suite-filtered) order.
          expect(new Set(missed), `${agent.id}/${suite.id}/${cat}`).toEqual(
            new Set(order.slice(0, missed.length)),
          );
        }
      }
    }
  });

  it("lands near the agent's real level", () => {
    const aurora = toPastRun(buildSessionRun("agent_aurora", "standard", "run_0149"));
    expect(aurora.score).toBeGreaterThanOrEqual(90);
    const checkout = toPastRun(buildSessionRun("agent_checkout", "gauntlet", "run_0150"));
    expect(checkout.score).toBeLessThanOrEqual(40);
  });

  it("reconciles counts in the PastRun projection", () => {
    const run = buildSessionRun("agent_aurora_12", "standard", "run_0151");
    const past = toPastRun(run);
    expect(past.passed + past.failed + past.partial).toBe(past.total);
    expect(past.total).toBe(run.scenarioIds.length);
    expect(past.critical).toBeLessThanOrEqual(past.failed);
  });

  it("only links replays whose demo outcome matches", () => {
    expect(canLinkReplay("SCN-0173", "fail")).toBe(true);
    expect(canLinkReplay("SCN-0173", "pass")).toBe(false);
    expect(canLinkReplay("SCN-0001", "pass")).toBe(true);
    expect(canLinkReplay("SCN-0001", "fail")).toBe(false);
  });

  it("allocates fresh run ids past the fixture history", () => {
    expect(nextRunId([])).toBe("run_0148");
    expect(
      nextRunId([buildSessionRun("agent_aurora", "smoke", "run_0150")]),
    ).toBe("run_0151");
  });
});
