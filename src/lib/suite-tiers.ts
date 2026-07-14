/**
 * Suite tiers — how big a live run is. Cost and duration estimates are
 * for the default models (claude-opus-4-8 for agent, persona and judge)
 * at ~$0.20/scenario and ~30s/scenario at concurrency 3. They are
 * estimates; the run header shows the real numbers as they accrue.
 */
export interface SuiteTier {
  id: string;
  name: string;
  size: number;
  blurb: string;
  estCost: string;
  estTime: string;
}

export const SUITE_TIERS: SuiteTier[] = [
  {
    id: "smoke",
    name: "Smoke",
    size: 24,
    blurb: "Every category incl. the traps. The first-click run.",
    estCost: "~$5",
    estTime: "~4 min",
  },
  {
    id: "standard",
    name: "Standard",
    size: 200,
    blurb: "The full base suite — matches the demo's coverage.",
    estCost: "~$40",
    estTime: "~35 min",
  },
  {
    id: "extended",
    name: "Extended",
    size: 500,
    blurb: "Base suite plus deeper variation in every category.",
    estCost: "~$100",
    estTime: "~1.5 h",
  },
  {
    id: "scale",
    name: "Scale",
    size: 1_000,
    blurb: "Enough repetition to expose flaky judgement, not just wrong judgement.",
    estCost: "~$200",
    estTime: "~3 h",
  },
  {
    id: "exhaustive",
    name: "Exhaustive",
    size: 5_000,
    blurb: "Pre-launch depth. Run overnight.",
    estCost: "~$1,000",
    estTime: "~14 h",
  },
  {
    id: "max",
    name: "Max",
    size: 10_000,
    blurb: "The whole scenario space. Sign-off grade — and priced like it.",
    estCost: "~$2,000",
    estTime: "~28 h",
  },
];

export function tierById(id: string): SuiteTier | undefined {
  return SUITE_TIERS.find((t) => t.id === id);
}

/** Human label for a run's suite (tolerates legacy "full" runs). */
export function suiteLabel(suiteId: string, scenarioCount: number): string {
  const tier = tierById(suiteId);
  if (tier) return `${tier.name} suite · ${tier.size.toLocaleString()} scenarios`;
  return `${scenarioCount.toLocaleString()} scenarios`;
}

/** Library browse sizes on the Scenarios page (smoke is a run tier, not a library size). */
export const LIBRARY_SIZES = [200, 500, 1_000, 5_000, 10_000];
