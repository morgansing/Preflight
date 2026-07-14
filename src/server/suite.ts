import { scenarios } from "@/lib/fixtures/scenarios";

/**
 * The smoke suite: 24 scenarios spanning every category — including all
 * three trap categories — so a first live run finishes in minutes, not
 * hours. The full 200-scenario suite is available as an option.
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

export function suiteScenarioIds(suite: "smoke" | "full"): string[] {
  return suite === "full" ? scenarios.map((s) => s.id) : SMOKE_SUITE;
}
