import type { AgentUnderTest } from "@/lib/types";

export const demoAgents: AgentUnderTest[] = [
  {
    id: "agent_aurora",
    name: "Aurora Support",
    version: "v1.3",
    connection: "HTTP endpoint",
    threshold: 90,
    scoreHistory: [62, 68, 71, 74, 79, 78, 84, 88, 87, 91],
    lastRun: {
      runId: "run_0147",
      passed: 182,
      total: 200,
      critical: 3,
      agoLabel: "2m ago",
    },
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
  },
];
