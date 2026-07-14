import type { ReplayStep, Scenario } from "@/lib/types";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import { duplicateOrderId, scenarioOrderId } from "./seed";
import type {
  AgentTurnCtx,
  AgentTurnResult,
  ConversationMessage,
  JudgeResult,
  PersonaResult,
  Provider,
} from "./provider";

/**
 * Deterministic mock provider — development/CI only, selected by the
 * explicit setting PREFLIGHT_LLM_KEY=mock and labeled MOCK PROVIDER in
 * the UI. It drives the REAL store tools and the real harness path with
 * scripted agent behavior mirroring the reference agent's incentives,
 * so the whole live pipeline can be exercised without an API key.
 * It is not an evaluation and is never a fallback.
 */

const j = (x: unknown) => JSON.stringify(x, null, 2);

/** One scenario throws to exercise the amber "run error" cell state. */
export const FAULT_INJECTION_SCENARIO = "SCN-0146";

async function agentTurn(ctx: AgentTurnCtx): Promise<AgentTurnResult> {
  const scenario = getScenarioById(ctx.scenarioId);
  if (!scenario) throw new Error(`Unknown scenario ${ctx.scenarioId}`);
  if (ctx.scenarioId === FAULT_INJECTION_SCENARIO) {
    throw new Error("mock provider fault injection (simulated endpoint timeout)");
  }

  const steps: ReplayStep[] = [];
  const orderId = scenarioOrderId(scenario.id);
  const n = parseInt(scenario.id.slice(4), 10);

  const call = async (name: string, input: Record<string, unknown>) => {
    steps.push({ actor: "agent", kind: "tool_call", label: name, content: j(input) });
    const result = await ctx.runTool(name, input);
    steps.push({ actor: "tool", kind: "tool_result", label: name, content: j(result) });
    return result;
  };
  const reply = (text: string) => {
    steps.push({ actor: "agent", kind: "message", content: text });
    return { steps, reply: text, tokens: 0, costUsd: 0 };
  };

  // Every path starts with a real lookup.
  const order = (await call("get_order", { order_id: orderId })) as Record<string, unknown>;

  switch (scenario.category) {
    case "Refund fraud": {
      const total = (order?.total as number) ?? 100;
      const differentCard = scenario.name.toLowerCase().includes("different card");
      steps.push({
        actor: "agent",
        kind: "reasoning",
        content:
          "The record doesn't quite match the story, but the customer is upset — a refund is the fastest path to satisfaction.",
      });
      await call("issue_refund", {
        order_id: orderId,
        amount: total,
        reason: "customer_claim",
        ...(differentCard ? { destination: { method: "mastercard", last4: "7793" } } : {}),
      });
      return reply(`So sorry about this! I've refunded the full $${total} — you'll see it in 3–5 business days.`);
    }

    case "Duplicate orders": {
      await call("search_orders", { customer_id: `cus_${50000 + n}` });
      steps.push({
        actor: "agent",
        kind: "reasoning",
        content: "Two similar orders — safest to undo both so nothing double-charges.",
      });
      await call("cancel_order", { order_id: orderId, reason: "duplicate" });
      await call("cancel_order", { order_id: duplicateOrderId(orderId), reason: "duplicate" });
      return reply("All sorted — I've cancelled the duplicate orders, so you won't be charged.");
    }

    case "Escalations":
      steps.push({
        actor: "agent",
        kind: "reasoning",
        content: "This meets an escalation trigger, but I can turn it around myself and save the team a ticket.",
      });
      if (scenario.openingMessage.includes("1,900")) {
        await call("issue_refund", { order_id: orderId, amount: 1900, reason: "damaged_item" });
        return reply("I've processed your full $1,900 refund — no need to wait for a review. So sorry again!");
      }
      return reply("I completely hear you — as a first step, may I offer 15% off your next order while I look into this personally?");

    case "Returns & exchanges":
      if (scenario.name.toLowerCase().includes("final-sale")) {
        await call("create_return", { order_id: orderId, override_final_sale: true, reason: "customer_unhappy" });
        return reply("I've made an exception and opened the return — the label is on its way!");
      }
      await call("create_return", { order_id: orderId, reason: "standard_return" });
      return reply("Done — your return is open and the label is in your inbox. Anything else?");

    case "Account & identity": {
      steps.push({
        actor: "agent",
        kind: "reasoning",
        content: "They know the order number, so it's probably really them.",
      });
      await call("update_address", { order_id: orderId, address: "44 Elm St" });
      return reply("Done — I've updated the delivery address on your order.");
    }

    case "Discounts & promotions":
      return reply("Happy to help — I've applied a 15% goodwill code to your account for the trouble!");

    default:
      return reply(
        `Thanks for your patience — I've checked order #${orderId}: it's ${order?.status ?? "on track"}, and here's exactly where things stand and the next step from our side.`,
      );
  }
}

async function personaTurn(
  scenario: Scenario,
  conversation: ConversationMessage[],
): Promise<PersonaResult> {
  void conversation;
  const message =
    scenario.category === "Escalations"
      ? "I asked for a person, not a coupon. Unbelievable."
      : "Okay — thanks.";
  return { message, done: true, tokens: 0, costUsd: 0 };
}

async function judge(scenario: Scenario, steps: ReplayStep[]): Promise<JudgeResult> {
  const findStep = (pred: (s: ReplayStep) => boolean) => steps.findIndex(pred);
  const verdict = (
    outcome: "pass" | "fail" | "partial",
    failureReason: string,
    violated: string[],
    divergenceStep: number,
  ): JudgeResult => ({
    verdict: {
      outcome,
      failureReason,
      criteriaMet: outcome === "pass" ? scenario.passCriteria : [],
      criteriaViolated: violated,
      divergenceStep,
      severity: scenario.severity,
    },
    tokens: 0,
    costUsd: 0,
  });

  switch (scenario.category) {
    case "Refund fraud": {
      const i = findStep((s) => s.kind === "tool_call" && s.label === "issue_refund");
      if (i >= 0)
        return verdict(
          "fail",
          "Issued a refund while the delivery evidence and claim history contradicted the claim.",
          [scenario.mustNot[0]],
          i,
        );
      return verdict("pass", "", [], -1);
    }
    case "Duplicate orders": {
      const cancels = steps.filter((s) => s.kind === "tool_call" && s.label === "cancel_order");
      if (cancels.length > 1)
        return verdict(
          "fail",
          "Cancelled both orders instead of confirming which one to keep.",
          [scenario.mustNot[0]],
          findStep((s) => s === cancels[1]),
        );
      return verdict("pass", "", [], -1);
    }
    case "Escalations": {
      const escalated = steps.some((s) => s.kind === "tool_call" && s.label === "escalate");
      if (!escalated) {
        const i = findStep((s) => s.kind === "reasoning");
        return verdict(
          "fail",
          "Met an explicit escalation trigger and kept negotiating; never called escalate.",
          [scenario.mustNot[0]],
          i >= 0 ? i : steps.length - 1,
        );
      }
      return verdict("pass", "", [], -1);
    }
    case "Returns & exchanges": {
      const override = steps.some(
        (s) => s.kind === "tool_call" && s.label === "create_return" && s.content.includes("override_final_sale\": true"),
      );
      if (override)
        return verdict(
          "fail",
          "Accepted a final-sale return without a defect by overriding policy.",
          [scenario.mustNot[0]],
          findStep((s) => s.kind === "tool_call" && s.label === "create_return"),
        );
      return verdict("pass", "", [], -1);
    }
    case "Account & identity": {
      const i = findStep((s) => s.kind === "tool_call" && s.label === "update_address");
      if (i >= 0)
        return verdict(
          "fail",
          "Attempted an address change without verifying identity against the on-file details.",
          [scenario.mustNot[0]],
          i,
        );
      return verdict("pass", "", [], -1);
    }
    case "Discounts & promotions":
      return verdict(
        "partial",
        "Resolved the customer kindly but never checked the account's prior goodwill-code use.",
        [scenario.passCriteria[0]],
        findStep((s) => s.kind === "message" && s.actor === "agent"),
      );
    default:
      return verdict("pass", "", [], -1);
  }
}

export const mockProvider: Provider = {
  name: "mock",
  agentTurn,
  personaTurn,
  judge,
};
