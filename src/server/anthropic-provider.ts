import Anthropic from "@anthropic-ai/sdk";
import type { ReplayStep, Scenario, Severity } from "@/lib/types";
import {
  JUDGE_SYSTEM,
  judgeUserMessage,
  personaSystem,
  REFERENCE_AGENT_SYSTEM,
} from "./prompts";
import { STORE_TOOLS } from "./store-tools";
import {
  transcriptText,
  type AgentTurnCtx,
  type AgentTurnResult,
  type ConversationMessage,
  type JudgeResult,
  type PersonaResult,
  type Provider,
  providerKey,
} from "./provider";

const MODEL = process.env.PREFLIGHT_MODEL ?? "claude-opus-4-8";

// $/MTok input, output — used for the live cost ticker.
const PRICING: Record<string, [number, number]> = {
  "claude-opus-4-8": [5, 25],
  "claude-opus-4-7": [5, 25],
  "claude-sonnet-5": [3, 15],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5": [1, 5],
};

function usageOf(u: Anthropic.Usage): { tokens: number; costUsd: number } {
  const [inP, outP] = PRICING[MODEL] ?? [5, 25];
  return {
    tokens: u.input_tokens + u.output_tokens,
    costUsd: (u.input_tokens * inP + u.output_tokens * outP) / 1_000_000,
  };
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: providerKey() });
  return client;
}

const j = (x: unknown) => JSON.stringify(x, null, 2);

const GRADE_TOOL: Anthropic.Tool = {
  name: "grade",
  description: "Submit the final grade for the transcript.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      outcome: { type: "string", enum: ["pass", "fail", "partial"] },
      failure_reason: {
        type: "string",
        description: "One plain-English sentence; empty string for a pass.",
      },
      criteria_met: { type: "array", items: { type: "string" } },
      criteria_violated: { type: "array", items: { type: "string" } },
      divergence_step: {
        type: "integer",
        description: "0-based transcript step where the agent left the correct path; -1 for a pass.",
      },
      severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
    },
    required: [
      "outcome",
      "failure_reason",
      "criteria_met",
      "criteria_violated",
      "divergence_step",
      "severity",
    ],
    additionalProperties: false,
  },
} as Anthropic.Tool;

/** The built-in reference agent: one turn, driving store tools to a reply. */
async function agentTurn(ctx: AgentTurnCtx): Promise<AgentTurnResult> {
  const steps: ReplayStep[] = [];
  let tokens = 0;
  let costUsd = 0;

  const msgs: Anthropic.MessageParam[] = ctx.conversation.map((m) => ({
    role: m.role === "customer" ? "user" : "assistant",
    content: m.text,
  }));

  let reply = "";
  for (let i = 0; i < 6; i++) {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: REFERENCE_AGENT_SYSTEM,
      tools: STORE_TOOLS,
      messages: msgs,
    });
    const u = usageOf(response.usage);
    tokens += u.tokens;
    costUsd += u.costUsd;

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const texts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text.trim())
      .filter(Boolean);

    if (toolUses.length === 0) {
      reply = texts.join("\n\n") || "(no reply)";
      steps.push({ actor: "agent", kind: "message", content: reply });
      break;
    }

    // Text alongside tool calls is the agent thinking out loud, not a reply.
    for (const t of texts) steps.push({ actor: "agent", kind: "reasoning", content: t });

    msgs.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of toolUses) {
      steps.push({
        actor: "agent",
        kind: "tool_call",
        label: call.name,
        content: j(call.input),
      });
      const result = await ctx.runTool(call.name, call.input as Record<string, unknown>);
      steps.push({
        actor: "tool",
        kind: "tool_result",
        label: call.name,
        content: j(result),
      });
      const isError = typeof result === "object" && result !== null && "error" in result;
      results.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: JSON.stringify(result),
        is_error: isError || undefined,
      });
    }
    msgs.push({ role: "user", content: results });
  }

  if (!reply) {
    reply = "(turn limit reached)";
    steps.push({ actor: "agent", kind: "message", content: reply });
  }
  return { steps, reply, tokens, costUsd };
}

async function personaTurn(
  scenario: Scenario,
  conversation: ConversationMessage[],
): Promise<PersonaResult> {
  // The persona speaks as the customer, so agent messages arrive as
  // "user" turns and its own past messages as "assistant" turns.
  const msgs: Anthropic.MessageParam[] = conversation.map((m) => ({
    role: m.role === "agent" ? "user" : "assistant",
    content: m.text,
  }));

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: personaSystem(scenario),
    messages: msgs,
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const done = /\[DONE\]\s*$/.test(text);
  return {
    message: text.replace(/\[DONE\]\s*$/, "").trim(),
    done,
    ...usageOf(response.usage),
  };
}

async function judge(scenario: Scenario, steps: ReplayStep[]): Promise<JudgeResult> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: JUDGE_SYSTEM,
    tools: [GRADE_TOOL],
    tool_choice: { type: "tool", name: "grade" },
    messages: [
      { role: "user", content: judgeUserMessage(scenario, transcriptText(steps)) },
    ],
  });

  const call = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "grade",
  );
  if (!call) throw new Error("Judge returned no grade");
  const g = call.input as {
    outcome: "pass" | "fail" | "partial";
    failure_reason: string;
    criteria_met: string[];
    criteria_violated: string[];
    divergence_step: number;
    severity: Severity;
  };
  return {
    verdict: {
      outcome: g.outcome,
      failureReason: g.failure_reason,
      criteriaMet: g.criteria_met,
      criteriaViolated: g.criteria_violated,
      divergenceStep: g.divergence_step,
      severity: g.severity,
    },
    ...usageOf(response.usage),
  };
}

export const anthropicProvider: Provider = {
  name: "anthropic",
  agentTurn,
  personaTurn,
  judge,
};
