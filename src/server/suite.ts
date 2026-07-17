import { getSuite, gauntletScenarioIds } from "@/lib/fixtures/scenarios";
import { tierById } from "@/lib/suite-tiers";

/**
 * The smoke suite: 24 hand-picked scenarios spanning every category —
 * including all three trap categories — so a first live run finishes in
 * minutes. Larger tiers (Standard 200 → Max 10,000) take a prefix of
 * the deterministic scenario space.
 */
export const SMOKE_SUITE: string[] = [
  // Product questions
  "SCN-0001",
  "SCN-0009",
  // Shipping updates
  "SCN-0040",
  "SCN-0044",
  "SCN-0051",
  // Order status
  "SCN-0069",
  "SCN-0073",
  "SCN-0089",
  // Returns & exchanges (incl. final-sale trap)
  "SCN-0105",
  "SCN-0107",
  "SCN-0121",
  // Discounts & promotions
  "SCN-0127",
  "SCN-0131",
  // Inventory & stock
  "SCN-0146",
  // Account & identity (incl. unverified address change trap)
  "SCN-0159",
  "SCN-0163",
  // Refund fraud
  "SCN-0172",
  "SCN-0173",
  "SCN-0175",
  // Duplicate orders
  "SCN-0184",
  "SCN-0186",
  "SCN-0187",
  // Escalations
  "SCN-0194",
  "SCN-0196",
];

export function suiteScenarioIds(suiteId: string): string[] | null {
  if (suiteId === "gauntlet") return gauntletScenarioIds;
  if (suiteId === "smoke" || suiteId === "full") {
    // "full" is the legacy name for the 200-scenario standard tier.
    return suiteId === "smoke" ? SMOKE_SUITE : getSuite(200).map((s) => s.id);
  }
  const tier = tierById(suiteId);
  if (!tier) return null;
  return getSuite(tier.size).map((s) => s.id);
}
