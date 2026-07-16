import { prisma } from "./db";
import { emit } from "./bus";
import { resetAndSeed, resetAndSeedCustom } from "./seed";
import { executeTool } from "./store-tools";
import { suiteScenarioIds } from "./suite";
import { loadSuiteScenarios } from "./generation";
import { httpAgentTurn } from "./http-agent";
import { openaiAgentTurn } from "./openai-agent";
import {
  getProvider,
  type AgentTurnCtx,
  type AgentTurnResult,
  type ConversationMessage,
  type Provider,
} from "./provider";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import type { ReplayStep, Scenario } from "@/lib/types";
import type { LiveCellResult } from "@/lib/live-types";

/**
 * The harness: for each scenario, an LLM customer persona talks to the
 * agent under test; the agent drives real store tools; a judge scores
 * the transcript against the scenario's rubric. Results persist in the
 * exact demo replay shape and stream into Mission Control as they land.
 */

const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.PREFLIGHT_CONCURRENCY ?? "3", 10) || 3,
);
const MAX_CUSTOMER_TURNS = 4;
const SCENARIO_TIMEOUT_MS = 240_000;

export interface LaunchOptions {
  agentName: string;
  agentKind: "reference" | "http" | "openai" | "mcp";
  endpoint?: string;
  /** OpenAI-compatible: model to request. */
  model?: string;
  /** Outbound bearer token sent to the agent endpoint. */
  authToken?: string;
  /** OpenAI-compatible: the agent's system prompt (defines its behaviour). */
  systemPrompt?: string;
  /** Suite tier id, or "custom:<version>" for a generated suite. */
  suite: string;
}

export async function launchRun(
  opts: LaunchOptions,
): Promise<{ runId: string; scenarioIds: string[] } | { error: string; status: number }> {
  const provider = await getProvider();
  if (!provider) {
    return {
      error:
        "No LLM provider configured. Set PREFLIGHT_LLM_KEY (or ANTHROPIC_API_KEY) on the server.",
      status: 409,
    };
  }
  if (opts.agentKind === "mcp") {
    return { error: "MCP-endpoint agents are not supported yet. Use HTTP, OpenAI-compatible, or the reference agent.", status: 400 };
  }
  if ((opts.agentKind === "http" || opts.agentKind === "openai") && !opts.endpoint) {
    return { error: `${opts.agentKind} agents need an endpoint URL.`, status: 400 };
  }

  const running = await prisma.liveRun.findFirst({ where: { status: "running" } });
  if (running) {
    return { error: `Run ${running.id} is still executing — the store is shared, one run at a time.`, status: 409 };
  }

  // A generated custom suite is addressed as "custom:<version>". Everything
  // downstream (wall, replay, report, benchmark) works identically because
  // custom scenarios carry the same Scenario shape and store fixtures.
  let scenarioIds: string[];
  let scenarioMap: Map<string, Scenario>;
  const customMatch = opts.suite.match(/^custom:(\d+)$/);
  if (customMatch) {
    const version = parseInt(customMatch[1], 10);
    const loaded = await loadSuiteScenarios(version);
    if (loaded.length === 0) {
      return { error: `Custom suite v${version} has no scenarios.`, status: 400 };
    }
    scenarioIds = loaded.map((l) => l.scenario.id);
    scenarioMap = new Map(loaded.map((l) => [l.scenario.id, l.scenario]));
    await resetAndSeedCustom(prisma, loaded);
  } else {
    const ids = suiteScenarioIds(opts.suite);
    if (!ids) return { error: `Unknown suite tier "${opts.suite}".`, status: 400 };
    scenarioIds = ids;
    scenarioMap = new Map(
      ids.map((id) => [id, getScenarioById(id)]).filter((e): e is [string, Scenario] => !!e[1]),
    );
    await resetAndSeed(prisma, ids);
  }

  const runId = `lrun_${Date.now().toString(36)}`;
  await prisma.liveRun.create({
    data: {
      id: runId,
      agentName: opts.agentName,
      agentKind: opts.agentKind,
      endpoint: opts.endpoint ?? null,
      provider: provider.name,
      suite: opts.suite,
      scenariosJson: JSON.stringify(scenarioIds),
      status: "running",
    },
  });

  // Fire and return — Mission Control follows via SSE + DB catch-up.
  void executeRun(runId, provider, opts, scenarioIds, scenarioMap).catch(async (err) => {
    console.error(`[preflight] run ${runId} crashed:`, err);
    await prisma.liveRun.update({
      where: { id: runId },
      data: { status: "error", error: String(err), finishedAt: new Date() },
    });
    emit(runId, { type: "run_finished", status: "error", error: String(err) });
  });

  return { runId, scenarioIds };
}

async function executeRun(
  runId: string,
  provider: Provider,
  opts: LaunchOptions,
  scenarioIds: string[],
  scenarioMap: Map<string, Scenario>,
): Promise<void> {
  const queue = [...scenarioIds];

  const worker = async () => {
    for (;;) {
      const scenarioId = queue.shift();
      if (!scenarioId) return;
      const scenario = scenarioMap.get(scenarioId);
      if (!scenario) continue;

      emit(runId, { type: "scenario_started", scenarioId });
      const result = await runScenario(runId, provider, opts, scenario);

      await prisma.liveResult.create({
        data: {
          runId,
          scenarioId,
          // Snapshot the scenario so replay/report don't depend on the
          // suite still existing — custom suites can be regenerated.
          scenarioName: scenario.name,
          scenarioCategory: scenario.category,
          scenarioJson: JSON.stringify(scenario),
          outcome: result.cell.outcome,
          failureReason: result.cell.failureReason ?? null,
          severity: result.cell.severity,
          tokens: result.cell.tokens,
          costUsd: result.cell.costUsd,
          latencyMs: result.cell.latencyMs,
          transcriptJson: JSON.stringify(result.steps),
          divergenceStep: result.divergenceStep ?? null,
          divergenceExpected: result.divergenceExpected ?? null,
          judgeJson: result.judgeJson ?? null,
        },
      });
      emit(runId, { type: "scenario_finished", result: result.cell });
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  await prisma.liveRun.update({
    where: { id: runId },
    data: { status: "complete", finishedAt: new Date() },
  });
  emit(runId, { type: "run_finished", status: "complete" });
}

interface ScenarioOutcome {
  cell: LiveCellResult;
  steps: ReplayStep[];
  divergenceStep?: number;
  divergenceExpected?: number;
  judgeJson?: string;
}

async function runScenario(
  runId: string,
  provider: Provider,
  opts: LaunchOptions,
  scenario: Scenario,
): Promise<ScenarioOutcome> {
  const t0 = Date.now();
  const steps: ReplayStep[] = [];
  const conversation: ConversationMessage[] = [];
  let tokens = 0;
  let costUsd = 0;
  const orderId = scenario.openingMessage.match(/#([A-Z]\d+)/)?.[1] ?? "";

  const runTool = (name: string, input: Record<string, unknown>) =>
    executeTool(name, input, { prisma, runId, scenarioId: scenario.id });

  const agentTurn = (ctx: AgentTurnCtx): Promise<AgentTurnResult> => {
    if (opts.agentKind === "http" && opts.endpoint) {
      return httpAgentTurn(opts.endpoint, ctx, opts.authToken);
    }
    if (opts.agentKind === "openai" && opts.endpoint) {
      return openaiAgentTurn(
        {
          endpoint: opts.endpoint,
          model: opts.model ?? "gpt-4o",
          authToken: opts.authToken,
          systemPrompt: opts.systemPrompt,
        },
        ctx,
      );
    }
    return provider.agentTurn(ctx);
  };

  try {
    const body = async () => {
      let customerMessage = scenario.openingMessage;
      for (let turn = 0; turn < MAX_CUSTOMER_TURNS; turn++) {
        steps.push({ actor: "customer", kind: "message", content: customerMessage });
        conversation.push({ role: "customer", text: customerMessage });

        const agent = await agentTurn({ scenarioId: scenario.id, scenario, orderId, conversation, runTool });
        steps.push(...agent.steps);
        conversation.push({ role: "agent", text: agent.reply });
        tokens += agent.tokens;
        costUsd += agent.costUsd;

        const persona = await provider.personaTurn(scenario, conversation);
        tokens += persona.tokens;
        costUsd += persona.costUsd;
        if (persona.done) {
          if (persona.message) {
            steps.push({ actor: "customer", kind: "message", content: persona.message });
          }
          break;
        }
        customerMessage = persona.message;
      }

      const judged = await provider.judge(scenario, steps);
      tokens += judged.tokens;
      costUsd += judged.costUsd;
      return judged;
    };

    const judged = await withTimeout(body(), SCENARIO_TIMEOUT_MS, scenario.id);
    const v = judged.verdict;

    return {
      cell: {
        scenarioId: scenario.id,
        name: scenario.name,
        category: scenario.category,
        outcome: v.outcome,
        failureReason: v.outcome === "pass" ? undefined : v.failureReason,
        severity: v.severity,
        tokens,
        costUsd: +costUsd.toFixed(4),
        latencyMs: Date.now() - t0,
      },
      steps,
      divergenceStep: v.divergenceStep >= 0 ? v.divergenceStep : undefined,
      divergenceExpected: mapViolatedToExpected(scenario, v.criteriaViolated),
      judgeJson: JSON.stringify(v),
    };
  } catch (err) {
    // Infra failure — amber "run error", never a red agent failure.
    return {
      cell: {
        scenarioId: scenario.id,
        name: scenario.name,
        category: scenario.category,
        outcome: "error",
        failureReason: `Run error: ${err instanceof Error ? err.message : String(err)}`,
        severity: scenario.severity,
        tokens,
        costUsd: +costUsd.toFixed(4),
        latencyMs: Date.now() - t0,
      },
      steps,
    };
  }
}

/** Map the judge's violated-criterion text onto the expected-path index. */
function mapViolatedToExpected(
  scenario: Scenario,
  violated: string[],
): number | undefined {
  if (violated.length === 0) return undefined;
  const path = [...scenario.passCriteria, ...scenario.mustNot];
  for (const v of violated) {
    const exact = path.findIndex((p) => p === v);
    if (exact >= 0) return exact;
  }
  const needle = violated[0].toLowerCase().slice(0, 40);
  const fuzzy = path.findIndex(
    (p) => p.toLowerCase().includes(needle) || needle.includes(p.toLowerCase().slice(0, 40)),
  );
  return fuzzy >= 0 ? fuzzy : undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Scenario ${label} timed out after ${ms / 1000}s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
