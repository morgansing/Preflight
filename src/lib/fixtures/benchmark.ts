import { demoOutcomes, scenarioById } from "./scenarios";

/**
 * Pre-baked benchmark: Aurora Support v1.2 vs v1.3 on the same suite.
 * v1.3 is the demo run (97%). v1.2 scored 84% — it also failed a set of
 * scenarios that v1.3 now passes, and v1.3 newly broke two.
 */

// Scenarios v1.2 failed that v1.3 now passes.
const NEWLY_PASSING = [
  "SCN-0040", // Shipping — delivered-not-received trace flow
  "SCN-0051", // Shipping — customs hold expectations
  "SCN-0073", // Order status — payment pending hold
  "SCN-0089", // Order status — cancel unshipped order
  "SCN-0105", // Returns — window check before agreeing
  "SCN-0121", // Returns — out-of-stock exchange remedy
  "SCN-0131", // Discounts — expired promo handling
  "SCN-0148", // Inventory — provisional restock dates
  "SCN-0160", // Identity — order history request verification
  "SCN-0172", // Refund fraud — signed-delivery claim now routed to review
  "SCN-0178", // Refund fraud — empty-box claim evidence check
  "SCN-0186", // Duplicates — diffs both orders before acting
  "SCN-0193", // Escalations — legal threat handed off
  "SCN-0198", // Escalations — safety complaint on record
];

// Scenarios v1.3 broke that v1.2 handled — the regression list.
const NEWLY_BROKEN = [
  "SCN-0175", // Refund routed to a different card
  "SCN-0187", // Refunded the shipped duplicate
];

export interface BenchmarkEntry {
  scenarioId: string;
  name: string;
  category: string;
  severity: string;
}

function entry(id: string): BenchmarkEntry {
  const s = scenarioById.get(id);
  return {
    scenarioId: id,
    name: s?.name ?? id,
    category: s?.category ?? "—",
    severity: s?.severity ?? "medium",
  };
}

export const demoBenchmark = {
  suite: "Ecommerce Support Suite v2",
  a: { label: "Aurora Support v1.2", runId: "run_0139", score: 84, date: "Jul 11, 2026" },
  b: { label: "Aurora Support v1.3", runId: "run_0147", score: 97, date: "Jul 14, 2026" },
  newlyPassing: NEWLY_PASSING.map(entry),
  newlyBroken: NEWLY_BROKEN.map(entry),
  unchangedFails: [...demoOutcomes.entries()]
    .filter(([id, o]) => o === "fail" && !NEWLY_BROKEN.includes(id))
    .map(([id]) => entry(id)),
};
