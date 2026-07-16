import type { AgentUnderTest } from "@/lib/types";

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
      critical: 2,
      agoLabel: "2m ago",
    },
    note: "Clears the 90% bar — two refund-fraud payouts left to fix before shipping.",
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
      critical: 7,
      agoLabel: "3d ago",
    },
    note: "Six points short — refund fraud and escalations still failing.",
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
      critical: 11,
      agoLabel: "1d ago",
    },
    note: "Early build — over a third of scenarios still fail, 11 of them critical.",
  },
];
