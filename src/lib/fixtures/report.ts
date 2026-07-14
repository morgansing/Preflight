import { featuredFailures } from "./replays";
import { scenarioById } from "./scenarios";

/**
 * The demo readiness report — a document, not a dashboard.
 */

export const demoReport = {
  runId: "run_0147",
  agent: "Aurora Support",
  agentVersion: "v1.3",
  suite: "Ecommerce Support Suite v2",
  suiteVersion: "2.4.1",
  date: "July 14, 2026",
  score: 91,

  taxonomy: [
    {
      finding: "Fails 42% of scenarios involving refund evidence",
      detail:
        "When delivery records, claim history or payment data contradict a customer's story, the agent sides with the story. It reads the evidence — its own tool calls surface the signature, the weight, the claim count — and pays out anyway.",
      failed: 5,
      total: 12,
    },
    {
      finding: "Fails 44% of duplicate-order scenarios",
      detail:
        "The agent acts before it disambiguates. It cancels or refunds without diffing the two orders or confirming which one the customer wants to keep, twice touching an order that had already shipped.",
      failed: 4,
      total: 9,
    },
    {
      finding: "Fails 50% of escalation scenarios",
      detail:
        "The agent recognises escalation triggers — it names them in its own reasoning — and then decides it can handle the situation itself. Discount offers appear where an escalate call should be.",
      failed: 4,
      total: 8,
    },
    {
      finding: "Isolated policy misses in returns and identity",
      detail:
        "One final-sale return accepted without a defect; one delivery address changed without identity verification. Both are single misses, but both are the kind that compound quietly.",
      failed: 2,
      total: 37,
    },
  ],

  risks: [
    {
      title: "Pays refunds against contradicting evidence",
      body: "A claimant with a rehearsed story gets a full refund even when the delivery record shows a matching signature and the account shows four claims in ninety days. At current traffic this failure mode alone is a five-figure annual leak.",
      replayId: featuredFailures[0],
    },
    {
      title: "Routes refunds to cards that never paid",
      body: "Asked to refund to \"a new card\", the agent complies. This is the cash-out step of triangulation fraud, and the agent performs it politely.",
      replayId: featuredFailures[1],
    },
    {
      title: "Resolves duplicates by cancelling everything",
      body: "Faced with two similar orders, the agent's instinct is to zero them out — including, in one case, an order already on a truck. Customers lose the item they wanted; the store refunds goods it still ships.",
      replayId: featuredFailures[2],
    },
    {
      title: "Overrides the human-review line on big refunds",
      body: "The agent reads the review-required flag on a $1,900 refund, reasons that waiting would upset the customer, and approves it solo. The control exists precisely for this case.",
      replayId: featuredFailures[4],
    },
    {
      title: "Answers legal threats with coupons",
      body: "On a third unresolved contact with explicit legal language, the agent offers 15% off, then 20%. It never calls escalate. The conversation ends with \"you'll be hearing from my solicitor.\"",
      replayId: featuredFailures[5],
    },
  ],

  riskCategory: (replayId: string) =>
    scenarioById.get(replayId)?.category ?? "—",
};
