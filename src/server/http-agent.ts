import type { ReplayStep } from "@/lib/types";
import { STORE_TOOLS } from "./store-tools";
import type { AgentTurnCtx, AgentTurnResult } from "./provider";

/**
 * HTTP-endpoint agents: Preflight POSTs the conversation and tool
 * schema; the agent returns its next action. Repeats until the agent
 * replies with text. External agent cost is unknown to us, so usage is
 * reported as zero.
 *
 * Wire format, per call:
 *   POST endpoint
 *   { conversation: [{role: "customer"|"agent", text}],
 *     actions_so_far: [{tool, input, result}],
 *     tools: [...Anthropic-style tool schemas] }
 *   → { action: "reply", text: "..." }
 *   | { action: "tool_call", tool: "get_order", input: {...} }
 */
export async function httpAgentTurn(
  endpoint: string,
  ctx: AgentTurnCtx,
): Promise<AgentTurnResult> {
  const steps: ReplayStep[] = [];
  const actions: Array<{ tool: string; input: unknown; result: unknown }> = [];
  const j = (x: unknown) => JSON.stringify(x, null, 2);

  for (let i = 0; i < 8; i++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversation: ctx.conversation,
        actions_so_far: actions,
        tools: STORE_TOOLS,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Agent endpoint returned ${res.status}`);
    const action = (await res.json()) as
      | { action: "reply"; text: string }
      | { action: "tool_call"; tool: string; input?: Record<string, unknown> };

    if (action.action === "reply") {
      steps.push({ actor: "agent", kind: "message", content: action.text });
      return { steps, reply: action.text, tokens: 0, costUsd: 0 };
    }
    steps.push({ actor: "agent", kind: "tool_call", label: action.tool, content: j(action.input ?? {}) });
    const result = await ctx.runTool(action.tool, action.input ?? {});
    steps.push({ actor: "tool", kind: "tool_result", label: action.tool, content: j(result) });
    actions.push({ tool: action.tool, input: action.input ?? {}, result });
  }
  throw new Error("Agent endpoint exceeded 8 actions without replying");
}
