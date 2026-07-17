import type { AgentUnderTest } from "@/lib/types";

// Base-suite category sizes (sum = 200), reused for per-agent breakdowns.
const CATS = [
  "Product questions",
  "Shipping updates",
  "Order status",
  "Returns & exchanges",
  "Discounts & promotions",
  "Inventory & stock",
  "Account & identity",
  "Refund fraud",
  "Duplicate orders",
  "Escalations",
] as const;
const TOTALS = [38, 30, 34, 24, 18, 14, 13, 12, 9, 8];
const breakdown = (passes: number[]) =>
  CATS.map((category, i) => ({ category, pass: passes[i], total: TOTALS[i] }));

export const demoAgents: AgentUnderTest[] = [
  {
    id: "agent_aurora",
    name: "Aurora Support",
    version: "v1.3",
    connection: "HTTP endpoint",
    threshold: 90,
    scoreHistory: [78, 82, 85, 87, 90, 89, 93, 95, 96, 97],
    lastRun: {
      runId: "run_0147",
      passed: 194,
      total: 200,
      // Critical-severity fails on the wall: two refund-fraud payouts
      // plus the missed legal-threat escalation.
      critical: 3,
      agoLabel: "2m ago",
    },
    note: "Clears the 90% bar — two refund-fraud payouts left to fix before shipping.",
    breakdown: breakdown([38, 30, 34, 23, 18, 14, 13, 10, 8, 6]), // 194
  },
  {
    id: "agent_aurora_12",
    name: "Aurora Support",
    version: "v1.2",
    connection: "HTTP endpoint",
    threshold: 90,
    scoreHistory: [58, 63, 66, 71, 70, 76, 79, 82, 84, 84],
    lastRun: {
      runId: "run_0139",
      passed: 168,
      total: 200,
      critical: 11,
      agoLabel: "3d ago",
    },
    note: "Six points short — refund fraud and escalations still failing.",
    // Must leave room for every v1.2 failure on the benchmark's
    // newly-passing list (2 shipping, 2 order status, 2 returns,
    // 1 discount, 1 inventory, 1 identity, 2 refund fraud, 1 duplicate,
    // 2 escalations) plus the three unchanged fails.
    breakdown: breakdown([38, 28, 32, 20, 16, 13, 9, 3, 5, 4]), // 168
  },
  {
    id: "agent_checkout",
    name: "Checkout Assistant",
    version: "v0.9",
    connection: "Reference agent",
    threshold: 90,
    scoreHistory: [41, 48, 52, 55, 61, 59, 64, 66, 65, 68],
    lastRun: {
      runId: "run_0141",
      passed: 136,
      total: 200,
      critical: 13,
      agoLabel: "1d ago",
    },
    note: "Early build — nearly a third of scenarios still fail, 13 of them critical.",
    breakdown: breakdown([36, 27, 30, 14, 10, 12, 4, 1, 1, 1]), // 136
  },
];
