import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
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
  type ClusterDraft,
  type ClusterNaming,
  type ConversationMessage,
  type JudgeResult,
  type PersonaResult,
  type Provider,
  providerKey,
} from "./provider";

const MODEL = config.model;

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
      evidence: {
        type: "array",
        description:
          "Show your work: for EVERY violated criterion — and for the 1-2 decisive met criteria on a pass — the verbatim transcript quote that proves it, with the 0-based step number it came from.",
        items: {
          type: "object",
          properties: {
            criterion: { type: "string" },
            quote: { type: "string", description: "Verbatim from the transcript step." },
            step: { type: "integer" },
          },
          required: ["criterion", "quote", "step"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "outcome",
      "failure_reason",
      "criteria_met",
      "criteria_violated",
      "divergence_step",
      "severity",
      "evidence",
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
    evidence: Array<{ criterion: string; quote: string; step: number }>;
  };
  return {
    verdict: {
      outcome: g.outcome,
      failureReason: g.failure_reason,
      criteriaMet: g.criteria_met,
      criteriaViolated: g.criteria_violated,
      divergenceStep: g.divergence_step,
      severity: g.severity,
      evidence: g.evidence ?? [],
    },
    ...usageOf(response.usage),
  };
}

const CLUSTERS_TOOL: Anthropic.Tool = {
  name: "submit_cluster_names",
  description: "Submit the diagnosis for every failure group.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      clusters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer", description: "The group's index from the input." },
            title: {
              type: "string",
              description:
                "The behaviour, as a diagnosis. E.g. \"Refunds under emotional pressure despite contradicting evidence\" — never \"Group 1\".",
            },
            root_cause: {
              type: "string",
              description: "2-3 sentences: what the agent keeps doing wrong and why it matters.",
            },
            fix: {
              type: "string",
              description: "1-2 sentences: the most direct prompt/logic change to try.",
            },
            merge_into: {
              type: "integer",
              description:
                "If this group is the SAME underlying behaviour as another group, that group's index; else -1.",
            },
          },
          required: ["index", "title", "root_cause", "fix", "merge_into"],
          additionalProperties: false,
        },
      },
    },
    required: ["clusters"],
    additionalProperties: false,
  },
} as Anthropic.Tool;

/** Name and merge failure groups — the "3 problems, not 55 failures" step. */
async function nameClusters(drafts: ClusterDraft[]): Promise<ClusterNaming[]> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system:
      "You are a QA lead writing the diagnosis section of an AI-agent readiness report. You turn grouped scenario failures into named root causes an engineer can act on. Always answer via the tool.",
    tools: [CLUSTERS_TOOL],
    tool_choice: { type: "tool", name: "submit_cluster_names" },
    messages: [
      {
        role: "user",
        content:
          `These failure groups came out of one evaluation run (grouped by violated rubric criterion). Name each as a root-cause diagnosis, and merge groups that are the same underlying behaviour:\n\n` +
          drafts
            .map(
              (d) =>
                `GROUP ${d.index} — ${d.count} scenario(s) across [${d.categories.join(", ")}]\n` +
                `  sample failures: ${d.sampleReasons.join(" | ")}\n` +
                `  sample scenarios: ${d.sampleScenarios.join("; ")}`,
            )
            .join("\n\n"),
      },
    ],
  });
  const call = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_cluster_names",
  );
  if (!call) throw new Error("Cluster naming returned no tool call");
  const input = call.input as {
    clusters: Array<{ index: number; title: string; root_cause: string; fix: string; merge_into: number }>;
  };
  return input.clusters.map((c) => ({
    index: c.index,
    title: c.title,
    rootCause: c.root_cause,
    fix: c.fix,
    mergeInto: c.merge_into,
  }));
}

export const anthropicProvider: Provider = {
  name: "anthropic",
  agentTurn,
  personaTurn,
  judge,
  nameClusters,
};
