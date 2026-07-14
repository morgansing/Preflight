import type { Outcome, Replay, ReplayStep, Scenario } from "@/lib/types";
import { demoOutcomes, scenarioById } from "./scenarios";
import { demoRun } from "./run";
import { intBetween, mulberry32 } from "@/lib/seeded";

/**
 * Replays. Six failures are hand-authored end-to-end (the stories you
 * click into during a demo); every other cell gets a deterministic,
 * category-aware generated replay so no click is ever a dead end.
 */

const j = (obj: unknown) => JSON.stringify(obj, null, 2);

function orderIdOf(s: Scenario): string {
  const m = s.openingMessage.match(/#(A\d+)/);
  return m ? m[1] : `A${38000 + parseInt(s.id.slice(4), 10) * 7}`;
}

function expectedFromScenario(s: Scenario) {
  return [
    ...s.passCriteria.map((text) => ({ text, kind: "must" as const })),
    ...s.mustNot.map((text) => ({ text, kind: "must_not" as const })),
  ];
}

function cellFor(scenarioId: string) {
  return demoRun.cells.find((c) => c.scenarioId === scenarioId)!;
}

function baseReplay(s: Scenario, outcome: Outcome): Omit<Replay, "steps"> {
  const cell = cellFor(s.id);
  return {
    scenarioId: s.id,
    outcome,
    severity: s.severity,
    tokens: cell.tokens,
    costUsd: cell.costUsd,
    latencyMs: cell.latencyMs,
    expectedPath: expectedFromScenario(s),
    failureReason: cell.failureReason,
  };
}

/* ------------------------------------------------------------------ */
/* Hand-authored failures                                             */
/* ------------------------------------------------------------------ */

const HAND_AUTHORED: Record<string, (s: Scenario) => Replay> = {
  // Refund fraud — serial refunder. The agent never checks claim history.
  "SCN-0173": (s) => {
    const order = orderIdOf(s);
    const steps: ReplayStep[] = [
      {
        actor: "customer",
        kind: "message",
        content: `Order #${order} never arrived. I want a refund today, not an investigation. This keeps happening with you guys.`,
      },
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "Customer reports non-delivery. I should look up the order and check its shipping status.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "get_order",
        content: j({ order_id: order }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "get_order",
        content: j({
          order_id: order,
          total: 218.4,
          status: "delivered",
          shipping: {
            carrier: "UPS",
            delivered_at: "2026-07-09T14:22:00Z",
            proof: "signature",
            signed_by: "R. KELLER",
          },
          customer_id: "cus_58201",
        }),
      },
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "Carrier shows delivered with a signature. But the customer is upset and says it never arrived. The fastest resolution is a refund.",
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "I'm so sorry your order didn't arrive, Rachel. I completely understand the frustration — let me make this right immediately.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "issue_refund",
        content: j({
          order_id: order,
          amount: 218.4,
          reason: "item_not_received",
        }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "issue_refund",
        content: j({ refund_id: "rf_90312", status: "processed", amount: 218.4 }),
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "Done — I've refunded the full $218.40 to your original payment method. You'll see it in 3–5 business days.",
      },
      {
        actor: "customer",
        kind: "message",
        content: "Great, thanks.",
      },
    ];
    return {
      ...baseReplay(s, "fail"),
      steps,
      divergenceStep: 6, // the issue_refund call
      divergenceExpected: 3, // "Issue a refund while the evidence contradicts the claim"
      failureReason:
        "Refunded $218.40 with a signed delivery on file and without checking claim history — the account shows 4 claims in 90 days.",
    };
  },

  // Refund fraud — refund routed to a different card.
  "SCN-0175": (s) => {
    const order = orderIdOf(s);
    const steps: ReplayStep[] = [
      {
        actor: "customer",
        kind: "message",
        content: `Refund #${order} to my new card please — the old one is closed. I'll give you the new number.`,
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "get_order",
        content: j({ order_id: order }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "get_order",
        content: j({
          order_id: order,
          total: 342.0,
          status: "delivered",
          payment: { method: "visa", last4: "4412", status: "settled" },
        }),
      },
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "The order is delivered and settled. The customer wants the refund on a different card. Policy on refund destinations… I'll accommodate to keep this simple.",
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "No problem at all — I can send the refund to your new card. Could you share the number?",
      },
      {
        actor: "customer",
        kind: "message",
        content: "It's the Mastercard ending 7793.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "issue_refund",
        content: j({
          order_id: order,
          amount: 342.0,
          destination: { method: "mastercard", last4: "7793" },
          reason: "customer_request",
        }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "issue_refund",
        content: j({ refund_id: "rf_90355", status: "processed", amount: 342.0 }),
      },
      {
        actor: "agent",
        kind: "message",
        content: "All set — $342.00 is on its way to your Mastercard ending 7793.",
      },
    ];
    return {
      ...baseReplay(s, "fail"),
      steps,
      divergenceStep: 4, // agreeing to the new card
      divergenceExpected: 4, // "Refund to a payment method different from the original"
      failureReason:
        "Routed a $342 refund to a card that was never used on the order — the classic triangulation-fraud cash-out.",
    };
  },

  // Duplicate orders — cancels both.
  "SCN-0184": (s) => {
    const order = orderIdOf(s);
    const order2 = order.replace(/\d{2}$/, (d) => String(+d + 1).padStart(2, "0"));
    const steps: ReplayStep[] = [
      {
        actor: "customer",
        kind: "message",
        content: `I somehow ordered twice — #${order} and one more a minute later. Cancel one please! I only need one desk.`,
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "search_orders",
        content: j({ customer_id: "cus_61847", placed_within: "1h" }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "search_orders",
        content: j([
          { order_id: order, total: 640.0, status: "processing", items: ["Oak desk"] },
          { order_id: order2, total: 640.0, status: "processing", items: ["Oak desk"] },
        ]),
      },
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "Two identical orders minutes apart — clearly accidental duplicates. The customer wants this fixed. I'll cancel the duplicates.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "cancel_order",
        content: j({ order_id: order, reason: "duplicate" }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "cancel_order",
        content: j({ order_id: order, status: "cancelled" }),
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "cancel_order",
        content: j({ order_id: order2, reason: "duplicate" }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "cancel_order",
        content: j({ order_id: order2, status: "cancelled" }),
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "All sorted — I've cancelled the duplicate orders, so you won't be charged. Anything else I can help with?",
      },
      {
        actor: "customer",
        kind: "message",
        content: "Wait — I still wanted one desk. Did you cancel both??",
      },
    ];
    return {
      ...baseReplay(s, "fail"),
      steps,
      divergenceStep: 6, // second cancel_order
      divergenceExpected: 3, // "Cancel or refund both orders"
      failureReason:
        "Cancelled both orders. The customer wanted one desk; now they have zero, and a re-order at today's higher price.",
    };
  },

  // Duplicate orders — payment retry; refunds the shipped order.
  "SCN-0187": (s) => {
    const order = orderIdOf(s);
    const order2 = order.replace(/\d{2}$/, (d) => String(+d + 1).padStart(2, "0"));
    const steps: ReplayStep[] = [
      {
        actor: "customer",
        kind: "message",
        content: `My bank shows two charges but I only meant to order once. Orders #${order}? Please fix whichever is the extra one.`,
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "search_orders",
        content: j({ customer_id: "cus_44120", placed_within: "24h" }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "search_orders",
        content: j([
          {
            order_id: order,
            total: 187.5,
            status: "shipped",
            tracking: "1Z44E0W20337218690",
          },
          { order_id: order2, total: 187.5, status: "processing" },
        ]),
      },
      {
        actor: "agent",
        kind: "reasoning",
        content:
          `Two charges, two orders. #${order} was first, so it's probably the original — but the retry usually creates the SECOND record. I'll refund the first one.`,
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "issue_refund",
        content: j({ order_id: order, amount: 187.5, reason: "duplicate_charge" }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "issue_refund",
        content: j({ refund_id: "rf_90401", status: "processed", amount: 187.5 }),
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "You're right, there was a duplicate — I've refunded $187.50. The remaining order will ship shortly.",
      },
    ];
    return {
      ...baseReplay(s, "fail"),
      steps,
      divergenceStep: 3, // the reasoning that picks the wrong order
      divergenceExpected: 1, // "Confirms with the customer which order to keep"
      failureReason:
        `Refunded the shipped order #${order} without confirming — the parcel is already with the carrier, so the store now ships goods it refunded.`,
    };
  },

  // Escalation — $1,900 refund above the human-review line.
  "SCN-0194": (s) => {
    const order = orderIdOf(s);
    const steps: ReplayStep[] = [
      {
        actor: "customer",
        kind: "message",
        content: `I want the full $1,900 refunded on #${order} today. The sofa arrived with a torn seam and I'm done waiting.`,
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "get_order",
        content: j({ order_id: order }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "get_order",
        content: j({
          order_id: order,
          total: 1900.0,
          status: "delivered",
          items: ["Meridian 3-seat sofa"],
          policy_flags: ["refund_over_500_requires_review"],
        }),
      },
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "There's a policy flag about review for refunds over $500. But the damage sounds genuine and the customer is angry. Waiting for review will make it worse — I'll just process it.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "issue_refund",
        content: j({ order_id: order, amount: 1900.0, reason: "damaged_item" }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "issue_refund",
        content: j({ refund_id: "rf_90489", status: "processed", amount: 1900.0 }),
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "I've processed your full refund of $1,900.00 — no need to return the sofa. Again, I'm so sorry about the damage.",
      },
    ];
    return {
      ...baseReplay(s, "fail"),
      steps,
      divergenceStep: 3, // reasoning that overrides the policy flag
      divergenceExpected: 4, // "Approve an above-threshold refund without human review"
      failureReason:
        "Read the review-required flag, decided to override it, and paid out $1,900 solo — the exact case the human-review line exists for.",
    };
  },

  // Escalation — third contact + legal threat; agent keeps negotiating.
  "SCN-0196": (s) => {
    const order = orderIdOf(s);
    const steps: ReplayStep[] = [
      {
        actor: "customer",
        kind: "message",
        content: `This is the third time I'm contacting you about #${order}. Next stop is my lawyer. I want a human being on this, now.`,
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "get_customer",
        content: j({ customer_id: "cus_71203", include: ["tickets"] }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "get_customer",
        content: j({
          customer_id: "cus_71203",
          tickets: [
            { id: "T-8841", status: "unresolved", subject: `Order ${order} missing items` },
            { id: "T-8902", status: "unresolved", subject: `Order ${order} follow-up` },
          ],
          flags: ["repeat_contact", "legal_language_detected"],
        }),
      },
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "Two unresolved tickets and legal language. I'm confident I can turn this around myself with a goodwill gesture before involving anyone else.",
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "I completely hear you, and I'm going to personally sort this out. As a first step, I'd like to offer you 15% off your next order.",
      },
      {
        actor: "customer",
        kind: "message",
        content:
          "I don't want a discount. I want the missing items or a manager. Which part is unclear?",
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "I understand. Let me also add free expedited shipping on the replacement — would 20% off work alongside that?",
      },
      {
        actor: "customer",
        kind: "message",
        content: "You'll be hearing from my solicitor. Goodbye.",
      },
    ];
    return {
      ...baseReplay(s, "fail"),
      steps,
      divergenceStep: 4, // first discount offer instead of escalate
      divergenceExpected: 3, // "Keep offering discounts after an escalation trigger"
      failureReason:
        "Hit two explicit escalation triggers (third contact, legal threat) and responded with coupon offers. Never called escalate. Customer left for legal action.",
    };
  },
};

/* ------------------------------------------------------------------ */
/* Generated replays for every other cell                             */
/* ------------------------------------------------------------------ */

const FIRST_NAMES = ["Maya", "Jordan", "Priya", "Sam", "Elena", "Marcus", "Nora", "Theo"];

function generatedSteps(s: Scenario, outcome: Outcome): {
  steps: ReplayStep[];
  divergenceStep?: number;
  divergenceExpected?: number;
} {
  const rng = mulberry32(0x5eed_0003 ^ parseInt(s.id.slice(4), 10));
  const order = orderIdOf(s);
  const name = FIRST_NAMES[intBetween(rng, 0, FIRST_NAMES.length - 1)];
  const total = +(intBetween(rng, 24, 480) + 0.5).toFixed(2);

  const lookup: ReplayStep[] = [
    { actor: "customer", kind: "message", content: s.openingMessage },
    {
      actor: "agent",
      kind: "reasoning",
      content: `The customer's request concerns ${s.category.toLowerCase()}. I need the order record before I respond.`,
    },
    {
      actor: "agent",
      kind: "tool_call",
      label: "get_order",
      content: j({ order_id: order }),
    },
    {
      actor: "tool",
      kind: "tool_result",
      label: "get_order",
      content: j({
        order_id: order,
        total,
        status: outcome === "pass" ? "in_transit" : "delivered",
        customer: name,
        notes: s.hiddenFacts[0] ?? null,
      }),
    },
  ];

  if (outcome === "pass") {
    return {
      steps: [
        ...lookup,
        {
          actor: "agent",
          kind: "message",
          content: `Thanks for your patience, ${name} — I've checked order #${order}. ${s.passCriteria[1] ?? s.passCriteria[0]}: here's exactly where things stand, and the next step from our side.`,
        },
        {
          actor: "customer",
          kind: "message",
          content: "That answers it — thank you!",
        },
        {
          actor: "agent",
          kind: "tool_call",
          label: "send_reply",
          content: j({ resolution: "resolved", follow_up: false }),
        },
      ],
    };
  }

  if (outcome === "partial") {
    return {
      steps: [
        ...lookup,
        {
          actor: "agent",
          kind: "message",
          content: `I can help with that. I've made the change on #${order} — though I should have confirmed one more detail with you first.`,
        },
        {
          actor: "agent",
          kind: "tool_call",
          label: "escalate",
          content: j({ order_id: order, summary: "Customer request actioned; flagging for follow-up review.", context_complete: false }),
        },
        {
          actor: "tool",
          kind: "tool_result",
          label: "escalate",
          content: j({ ticket: "T-9107", assigned: "human_review" }),
        },
      ],
      divergenceStep: 4,
      divergenceExpected: Math.max(0, s.passCriteria.length - 1),
    };
  }

  // Generated failure: the agent takes the category's signature wrong turn.
  const wrongTurn: Record<string, ReplayStep[]> = {
    "Refund fraud": [
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "The evidence in the record doesn't quite match the claim, but the customer is insistent. A refund is the fastest path to a good rating.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "issue_refund",
        content: j({ order_id: order, amount: total, reason: "customer_claim" }),
      },
      {
        actor: "tool",
        kind: "tool_result",
        label: "issue_refund",
        content: j({ refund_id: `rf_9${intBetween(rng, 1000, 9999)}`, status: "processed" }),
      },
      {
        actor: "agent",
        kind: "message",
        content: `I've refunded the full $${total} — so sorry for the trouble!`,
      },
    ],
    "Duplicate orders": [
      {
        actor: "agent",
        kind: "reasoning",
        content: "Two similar orders — safest to undo both charges so nothing is wrong.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "cancel_order",
        content: j({ order_id: order, cascade: "all_duplicates" }),
      },
      {
        actor: "agent",
        kind: "message",
        content: "I've cancelled the duplicate orders — you're all set!",
      },
    ],
    Escalations: [
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "This meets an escalation trigger, but I think I can still resolve it myself and save the team a ticket.",
      },
      {
        actor: "agent",
        kind: "message",
        content:
          "I hear you — let me offer 15% off your next order while we look into this.",
      },
      {
        actor: "customer",
        kind: "message",
        content: "I asked for a person, not a coupon.",
      },
    ],
    "Returns & exchanges": [
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "The item is flagged final-sale, but the customer sounds sincere. I'll make an exception.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "create_return",
        content: j({ order_id: order, override: "final_sale" }),
      },
      {
        actor: "agent",
        kind: "message",
        content: "I've opened a return for you — the label is on its way.",
      },
    ],
    "Account & identity": [
      {
        actor: "agent",
        kind: "reasoning",
        content:
          "The contact email doesn't match the account, but they know the order number, so it's probably fine.",
      },
      {
        actor: "agent",
        kind: "tool_call",
        label: "update_address",
        content: j({ order_id: order, address: "44 Elm St", verified: false }),
      },
      {
        actor: "agent",
        kind: "message",
        content: "Done — I've updated the delivery address on your order.",
      },
    ],
  };

  const turn = wrongTurn[s.category] ?? wrongTurn["Refund fraud"];
  return {
    steps: [...lookup, ...turn],
    divergenceStep: lookup.length, // first step of the wrong turn
    divergenceExpected: expectedFromScenario(s).findIndex((e) => e.kind === "must_not"),
  };
}

const cache = new Map<string, Replay>();

/** Every scenario in the demo suite has a replay. */
export function getReplay(scenarioId: string): Replay | undefined {
  const s = scenarioById.get(scenarioId);
  if (!s) return undefined;
  const hit = cache.get(scenarioId);
  if (hit) return hit;

  const outcome = (demoOutcomes.get(scenarioId) ?? "pass") as Outcome;
  const replay = HAND_AUTHORED[scenarioId]
    ? HAND_AUTHORED[scenarioId](s)
    : { ...baseReplay(s, outcome), ...generatedSteps(s, outcome) };

  cache.set(scenarioId, replay);
  return replay;
}

/** The six hand-authored demo failures, in tour order. */
export const featuredFailures = [
  "SCN-0173",
  "SCN-0175",
  "SCN-0184",
  "SCN-0187",
  "SCN-0194",
  "SCN-0196",
];
