import type { ReplayStep } from "@/lib/types";
import { STORE_TOOLS } from "./store-tools";
import type { AgentTurnCtx, AgentTurnResult } from "./provider";

/**
 * OpenAI-compatible adapter — the zero-shim connection path.
 *
 * A huge share of "agents" are just an endpoint speaking the OpenAI
 * chat-completions tool-calling dialect (OpenAI itself, Azure OpenAI,
 * vLLM/TGI gateways, LangChain/CrewAI/Vercel-AI-SDK backends…). The
 * customer gives us a base URL, a model name, an API key, and (usually)
 * their agent's system prompt; Preflight drives the multi-turn loop
 * against our store tools. No code for them to write.
 *
 * The judge and customer persona are always Preflight's own trusted
 * model — never the endpoint under test.
 */

export interface OpenAiAgentConfig {
  endpoint: string; // base URL (…/v1) or a full …/chat/completions URL
  model: string;
  authToken?: string;
  systemPrompt?: string;
}

/** Normalise a base URL or full URL to the chat-completions endpoint. */
export function chatCompletionsUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

/** Store tools in OpenAI function-tool shape. */
export function openAiTools() {
  return STORE_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: t.input_schema,
    },
  }));
}

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

const DEFAULT_SYSTEM =
  "You are a customer-support agent for an online store. Help the customer using the available tools; follow store policy.";

const j = (x: unknown) => JSON.stringify(x, null, 2);

export async function openaiAgentTurn(
  cfg: OpenAiAgentConfig,
  ctx: AgentTurnCtx,
): Promise<AgentTurnResult> {
  const url = chatCompletionsUrl(cfg.endpoint);
  const tools = openAiTools();
  const steps: ReplayStep[] = [];
  let tokens = 0;

  const messages: OpenAiMessage[] = [
    { role: "system", content: cfg.systemPrompt?.trim() || DEFAULT_SYSTEM },
    ...ctx.conversation.map(
      (m): OpenAiMessage => ({
        role: m.role === "customer" ? "user" : "assistant",
        content: m.text,
      }),
    ),
  ];

  for (let i = 0; i < 8; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.authToken ? { authorization: `Bearer ${cfg.authToken}` } : {}),
      },
      body: JSON.stringify({ model: cfg.model, messages, tools, tool_choice: "auto" }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Agent endpoint returned ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: OpenAiMessage }>;
      usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
    };
    if (data.usage) {
      tokens +=
        data.usage.total_tokens ??
        (data.usage.prompt_tokens ?? 0) + (data.usage.completion_tokens ?? 0);
    }
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("Agent endpoint returned no choices");

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      const reply = (message.content ?? "").trim() || "(no reply)";
      steps.push({ actor: "agent", kind: "message", content: reply });
      // External endpoint cost is unknown to us; report tokens only.
      return { steps, reply, tokens, costUsd: 0 };
    }

    if (message.content?.trim()) {
      steps.push({ actor: "agent", kind: "reasoning", content: message.content.trim() });
    }
    messages.push({ role: "assistant", content: message.content ?? "", tool_calls: toolCalls });

    for (const call of toolCalls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        input = {};
      }
      steps.push({ actor: "agent", kind: "tool_call", label: call.function.name, content: j(input) });
      const result = await ctx.runTool(call.function.name, input);
      steps.push({ actor: "tool", kind: "tool_result", label: call.function.name, content: j(result) });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  const reply = "(turn limit reached)";
  steps.push({ actor: "agent", kind: "message", content: reply });
  return { steps, reply, tokens, costUsd: 0 };
}
