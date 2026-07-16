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
  score: 97,

  taxonomy: [
    {
      finding: "Still pays refunds when the evidence contradicts the claim",
      detail:
        "97% ready, but the misses that remain are the expensive ones. Twice, when delivery records, claim history or payment data contradicted a customer's story, the agent sided with the story — its own tool calls surfaced the signature and the claim count, and it paid out anyway.",
      failed: 2,
      total: 12,
    },
    {
      finding: "Cancels both orders on a duplicate — including one already shipped",
      detail:
        "On the one duplicate it mishandles, the agent acts before it disambiguates: it cancels both orders without confirming which the customer wants to keep, zeroing out an order that had already left the warehouse.",
      failed: 1,
      total: 9,
    },
    {
      finding: "Answers a legal threat with a coupon instead of escalating",
      detail:
        "On a third unresolved contact with explicit legal language, the agent names the escalation trigger in its own reasoning and then decides it can handle it — offering a discount where an escalate call should be.",
      failed: 1,
      total: 8,
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
