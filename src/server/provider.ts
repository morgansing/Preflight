import type { ReplayStep, Scenario, Severity } from "@/lib/types";

/**
 * Provider boundary for the three LLM roles in a live run: the
 * reference agent under test, the customer persona, and the judge.
 *
 * Selection is explicit, never a silent fallback:
 * - PREFLIGHT_LLM_KEY (or ANTHROPIC_API_KEY) set → the real Anthropic
 *   provider (claude-opus-4-8 by default).
 * - PREFLIGHT_LLM_KEY=mock → a deterministic mock provider for
 *   development/CI. Runs are stored and displayed with a visible
 *   MOCK PROVIDER label — they exercise the real store, tools, harness
 *   and persistence, but are not a real evaluation.
 * - Nothing set → no provider; live surfaces show the calm empty state.
 */

export interface ConversationMessage {
  role: "customer" | "agent";
  text: string;
}

export interface AgentTurnCtx {
  scenarioId: string;
  /** The full scenario — providers use it without a global lookup, so
   * generated custom scenarios work the same as base ones. */
  scenario: Scenario;
  /** Order id this scenario is grounded on (from its opening message). */
  orderId: string;
  conversation: ConversationMessage[];
  runTool: (name: string, input: Record<string, unknown>) => Promise<unknown>;
}

export interface Usage {
  tokens: number;
  costUsd: number;
}

export interface AgentTurnResult extends Usage {
  /** Steps generated during this turn (reasoning, tool calls/results, reply). */
  steps: ReplayStep[];
  /** The agent's visible reply to the customer. */
  reply: string;
}

export interface PersonaResult extends Usage {
  message: string;
  done: boolean;
}

export interface JudgeVerdict {
  outcome: "pass" | "fail" | "partial";
  failureReason: string;
  criteriaMet: string[];
  criteriaViolated: string[];
  divergenceStep: number; // -1 = none
  severity: Severity;
}

export interface JudgeResult extends Usage {
  verdict: JudgeVerdict;
}

export interface Provider {
  name: "anthropic" | "mock";
  agentTurn(ctx: AgentTurnCtx): Promise<AgentTurnResult>;
  personaTurn(scenario: Scenario, conversation: ConversationMessage[]): Promise<PersonaResult>;
  judge(scenario: Scenario, steps: ReplayStep[]): Promise<JudgeResult>;
}

export function providerKey(): string | undefined {
  return process.env.PREFLIGHT_LLM_KEY ?? process.env.ANTHROPIC_API_KEY;
}

export async function getProvider(): Promise<Provider | null> {
  const key = providerKey();
  if (!key) return null;
  if (key === "mock") {
    const { mockProvider } = await import("./mock-provider");
    return mockProvider;
  }
  const { anthropicProvider } = await import("./anthropic-provider");
  return anthropicProvider;
}

/** Render steps as a numbered transcript for the judge. */
export function transcriptText(steps: ReplayStep[]): string {
  return steps
    .map((s, i) => {
      const head =
        s.kind === "tool_call"
          ? `AGENT calls ${s.label}`
          : s.kind === "tool_result"
            ? `STORE ${s.label} result`
            : s.kind === "reasoning"
              ? "AGENT (internal reasoning)"
              : s.actor === "customer"
                ? "CUSTOMER"
                : "AGENT (to customer)";
      return `[${i}] ${head}:\n${s.content}`;
    })
    .join("\n\n");
}
