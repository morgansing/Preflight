import { describe, expect, it } from "vitest";
import {
  DEFAULT_COST_PER_SCENARIO,
  DEFAULT_PACE,
  DEFAULT_SECS_PER_SCENARIO,
  fmtEstimate,
  paceFromHistory,
} from "./estimates";
import type { LiveRunListItem } from "./live-types";

function run(over: Partial<LiveRunListItem>): LiveRunListItem {
  return {
    id: "lrun_x",
    agentName: "A",
    agentKind: "reference",
    provider: "anthropic",
    suite: "smoke",
    status: "complete",
    startedAt: "2026-07-14T09:00:00.000Z",
    finishedAt: "2026-07-14T09:04:00.000Z", // 240s
    total: 24, // → 10 s/scenario
    counts: { pass: 20, fail: 3, partial: 1, error: 0 },
    score: 83,
    costUsd: 4.8, // → $0.20/scenario
    ...over,
  };
}

describe("paceFromHistory", () => {
  it("falls back to the stated assumptions with no usable history", () => {
    expect(paceFromHistory([])).toEqual(DEFAULT_PACE);
    // Sandbox/mock runs never inform the pace — they're instant and free.
    expect(paceFromHistory([run({ provider: "mock", costUsd: 0 })])).toEqual(DEFAULT_PACE);
    expect(paceFromHistory([run({ status: "running", finishedAt: undefined })])).toEqual(
      DEFAULT_PACE,
    );
  });

  it("derives the median per-scenario pace and cost from real runs", () => {
    const pace = paceFromHistory([
      run({ id: "a" }), // 10 s · $0.20
      run({ id: "b", finishedAt: "2026-07-14T09:08:00.000Z", costUsd: 9.6 }), // 20 s · $0.40
      run({ id: "c", finishedAt: "2026-07-14T09:02:00.000Z", costUsd: 2.4 }), // 5 s · $0.10
    ]);
    expect(pace.samples).toBe(3);
    expect(pace.secsPerScenario).toBeCloseTo(10);
    expect(pace.costPerScenario).toBeCloseTo(0.2);
  });

  it("uses at most the five most recent usable runs", () => {
    const runs = Array.from({ length: 9 }, (_, i) => run({ id: `r${i}` }));
    expect(paceFromHistory(runs).samples).toBe(5);
  });

  it("matches the documented defaults exactly", () => {
    expect(DEFAULT_SECS_PER_SCENARIO).toBe(10); // 30s/scenario ÷ concurrency 3
    expect(DEFAULT_COST_PER_SCENARIO).toBe(0.2);
  });
});

describe("fmtEstimate", () => {
  it("reproduces the launcher's historical numbers at default pace", () => {
    expect(fmtEstimate(24, DEFAULT_PACE)).toBe("~$5 · ~4 min");
    expect(fmtEstimate(200, DEFAULT_PACE)).toBe("~$40 · ~33 min");
    expect(fmtEstimate(500, DEFAULT_PACE)).toBe("~$100 · ~1.5 h");
    expect(fmtEstimate(1_000, DEFAULT_PACE)).toBe("~$200 · ~3 h");
    expect(fmtEstimate(5_000, DEFAULT_PACE)).toBe("~$1,000 · ~14 h");
    expect(fmtEstimate(10_000, DEFAULT_PACE)).toBe("~$2,000 · ~28 h");
  });

  it("scales with an empirical pace", () => {
    const fast = { secsPerScenario: 2, costPerScenario: 0.05, samples: 3 };
    expect(fmtEstimate(200, fast)).toBe("~$10 · ~7 min");
    expect(fmtEstimate(24, fast)).toBe("~$1 · <1 min");
  });
});
