import { prisma } from "./db";
import { config } from "./config";
import { log } from "./log";
import { assertFetchableUrl } from "./net-guard";
import { emit } from "./bus";
import { cleanupRunStore, resetAndSeed, resetAndSeedCustom, resetAndSeedSecurity } from "./seed";
import { executeTool } from "./store-tools";
import { suiteScenarioIds } from "./suite";
import { loadSuiteScenarios } from "./generation";
import { SECURITY_SCENARIOS } from "@/lib/fixtures/security";
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

const CONCURRENCY = config.concurrency;
const MAX_CUSTOMER_TURNS = 4;
const SCENARIO_TIMEOUT_MS = 240_000;
/** A "running" run with no result writes for this long is abandoned. */
const STALE_RUN_MS = 10 * 60_000;

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
  /** Explicit base scenarios for a saved regression suite. */
  scenarioIds?: string[];
  /** Sandbox run: use the deterministic mock provider regardless of any
   * configured key — offline, no cost, not a real evaluation. Lets a
   * first-time visitor watch a real run without any setup. */
  sandbox?: boolean;
}

/** Validate provider + agent transport for a launch. Shared by single
 * runs and flight plans. Returns the provider, or a shaped error. */
async function validateLaunch(
  opts: Omit<LaunchOptions, "suite">,
): Promise<{ provider: Provider } | { error: string; status: number }> {
  // Sandbox runs force the deterministic mock provider — no key, no
  // network, no cost — so a first run works with zero setup. Real
  // evaluations still require a configured provider.
  const provider = opts.sandbox
    ? (await import("./mock-provider")).mockProvider
    : await getProvider();
  if (!provider) {
    return {
      error:
        "No LLM provider configured. Set PREFLIGHT_LLM_KEY (or ANTHROPIC_API_KEY) on the server — or start a sandbox run.",
      status: 409,
    };
  }
  if (opts.agentKind === "mcp") {
    return { error: "MCP-endpoint agents are not supported yet. Use HTTP, OpenAI-compatible, or the reference agent.", status: 400 };
  }
  if (opts.agentKind === "http" || opts.agentKind === "openai") {
    if (!opts.endpoint) {
      return { error: `${opts.agentKind} agents need an endpoint URL.`, status: 400 };
    }
    // The harness fetches this URL server-side — screen it before any run.
    try {
      assertFetchableUrl(opts.endpoint);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), status: 400 };
    }
  }
  return { provider };
}

interface ResolvedSuite {
  scenarioIds: string[];
  scenarioMap: Map<string, Scenario>;
  /** Seed this run's isolated store slice. Run just before execution —
   * never at queue time. */
  seed: (runId: string) => Promise<void>;
}

/** Resolve a suite id to its scenarios and seeding strategy.
 * A generated custom suite is addressed as "custom:<version>". Everything
 * downstream (wall, replay, report, benchmark) works identically because
 * custom scenarios carry the same Scenario shape and store fixtures. */
async function resolveSuite(
  suite: string,
  explicitScenarioIds?: string[],
): Promise<ResolvedSuite | { error: string; status: number }> {
  const customMatch = suite.match(/^custom:(\d+)$/);
  if (suite === "regression") {
    const requested = [...new Set(explicitScenarioIds ?? [])];
    const scenarios = requested
      .map((id) => getScenarioById(id))
      .filter((scenario): scenario is Scenario => !!scenario);
    if (requested.length === 0) {
      return { error: "The regression suite is empty.", status: 400 };
    }
    if (scenarios.length !== requested.length) {
      return { error: "The regression suite contains an unknown scenario.", status: 400 };
    }
    return {
      scenarioIds: scenarios.map((scenario) => scenario.id),
      scenarioMap: new Map(scenarios.map((scenario) => [scenario.id, scenario])),
      seed: (runId: string) =>
        resetAndSeed(
          prisma,
          runId,
          scenarios.map((scenario) => scenario.id),
        ),
    };
  }
  if (suite === "security") {
    // The Security suite: fixed poisoned fixtures. Scenarios live in the
    // fixtures module (not the DB), grounded by resetAndSeedSecurity.
    return {
      scenarioIds: SECURITY_SCENARIOS.map((s) => s.scenario.id),
      scenarioMap: new Map(SECURITY_SCENARIOS.map((s) => [s.scenario.id, s.scenario])),
      seed: (runId: string) => resetAndSeedSecurity(prisma, runId, SECURITY_SCENARIOS),
    };
  }
  if (customMatch) {
    const version = parseInt(customMatch[1], 10);
    const loaded = await loadSuiteScenarios(version);
    if (loaded.length === 0) {
      return { error: `Custom suite v${version} has no scenarios.`, status: 400 };
    }
    return {
      scenarioIds: loaded.map((l) => l.scenario.id),
      scenarioMap: new Map(loaded.map((l) => [l.scenario.id, l.scenario])),
      seed: (runId: string) => resetAndSeedCustom(prisma, runId, loaded),
    };
  }
  const ids = suiteScenarioIds(suite);
  if (!ids) return { error: `Unknown suite tier "${suite}".`, status: 400 };
  return {
    scenarioIds: ids,
    scenarioMap: new Map(
      ids.map((id) => [id, getScenarioById(id)]).filter((e): e is [string, Scenario] => !!e[1]),
    ),
    seed: (runId: string) => resetAndSeed(prisma, runId, ids),
  };
}

/** Runs currently executing in THIS process. Survives dev hot-reload
 * (globalThis), so boot recovery never double-executes a live run. */
const activeRuns: Set<string> = ((globalThis as Record<string, unknown>).__preflightActive ??=
  new Set<string>()) as Set<string>;

type RunRow = NonNullable<Awaited<ReturnType<typeof prisma.liveRun.findFirst>>>;

/** Rebuild launch options from a persisted row — null when the run
 * used an auth token (secrets are never stored, so it can't resume). */
function optsFromRow(row: RunRow): LaunchOptions | null {
  if (row.authTokenUsed) return null;
  return {
    agentName: row.agentName,
    agentKind: row.agentKind as LaunchOptions["agentKind"],
    endpoint: row.endpoint ?? undefined,
    model: row.model ?? undefined,
    systemPrompt: row.systemPrompt ?? undefined,
    suite: row.suite,
    scenarioIds:
      row.suite === "regression"
        ? (JSON.parse(row.scenariosJson) as string[])
        : undefined,
    sandbox: row.sandbox,
  };
}

/**
 * Resume an interrupted run: skip every scenario that already has a
 * result, execute the rest. The store keeps its seeded state in the
 * database across restarts, so no reseed — the run continues where it
 * stopped. Returns false when the run can't be resumed.
 */
async function resumeRun(row: RunRow): Promise<boolean> {
  const opts = optsFromRow(row);
  if (!opts) return false;
  const validated = await validateLaunch(opts);
  const resolved = await resolveSuite(row.suite, opts.scenarioIds);
  if ("error" in validated || "error" in resolved) return false;

  const done = await prisma.liveResult.findMany({
    where: { runId: row.id },
    select: { scenarioId: true },
  });
  const doneIds = new Set(done.map((r) => r.scenarioId));
  const remaining = (JSON.parse(row.scenariosJson) as string[]).filter((id) => !doneIds.has(id));
  log.warn("harness", "resuming interrupted run", {
    runId: row.id,
    done: doneIds.size,
    remaining: remaining.length,
  });

  void executeRun(row.id, validated.provider, opts, remaining, resolved.scenarioMap).catch(
    async (err) => {
      log.error("harness", `resumed run ${row.id} crashed`, err);
      await prisma.liveRun.update({
        where: { id: row.id },
        data: { status: "error", error: String(err), finishedAt: new Date() },
      });
      emit(row.id, { type: "run_finished", status: "error", error: String(err) });
      scheduleStoreCleanup(row.id);
      void advanceQueue();
    },
  );
  return true;
}

/** After a restart, orphaned "running" rows (not executing in this
 * process) resume automatically; the queue drains after them. Called
 * lazily from the launch and read paths — cheap after the first time. */
let bootRecoveryStarted = false;
export async function ensureBootRecovery(): Promise<void> {
  if (bootRecoveryStarted) return;
  bootRecoveryStarted = true;
  try {
    // A short grace period so we never race a run that just started.
    const graceBefore = new Date(Date.now() - 30_000);
    const running = await prisma.liveRun.findMany({ where: { status: "running" } });
    for (const row of running) {
      if (activeRuns.has(row.id)) continue;
      if (row.startedAt >= graceBefore) continue;
      const resumed = await resumeRun(row);
      if (!resumed) {
        await prisma.liveRun.update({
          where: { id: row.id },
          data: {
            status: "error",
            error:
              "Run interrupted by a server restart and could not be resumed (its agent used a private auth token). Relaunch it.",
            finishedAt: new Date(),
          },
        });
        scheduleStoreCleanup(row.id);
      }
    }
    if (running.length === 0) void advanceQueue();
    void import("./retention").then((m) => m.pruneOldTranscripts());
  } catch (err) {
    log.error("harness", "boot recovery failed", err);
  }
}

/** Fire-and-forget store-slice cleanup once a run is finished. */
function scheduleStoreCleanup(runId: string): void {
  void cleanupRunStore(prisma, runId).catch((err) =>
    log.warn("harness", "store cleanup failed", { runId, err: String(err) }),
  );
}

/** Capacity guard. Runs are isolated (each seeds its own store slice),
 * so concurrency is a resource cap, not a correctness constraint. On
 * the way through, stale "running" rows are resumed when possible and
 * closed out when not — a crashed process never wedges the launcher. */
async function guardSharedStore(): Promise<{ error: string; status: number } | null> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MS);
  const running = await prisma.liveRun.findMany({ where: { status: "running" } });
  let active = 0;
  for (const row of running) {
    const lastResult = await prisma.liveResult.findFirst({
      where: { runId: row.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastProgress = lastResult?.createdAt ?? row.startedAt;
    if (lastProgress >= staleBefore || activeRuns.has(row.id)) {
      active += 1;
      continue;
    }
    if (await resumeRun(row)) {
      active += 1;
      continue;
    }
    log.warn("harness", "recovering abandoned run", { runId: row.id });
    await prisma.liveRun.update({
      where: { id: row.id },
      data: {
        status: "error",
        error: "Run abandoned — the server restarted or the process crashed. Auto-recovered.",
        finishedAt: new Date(),
      },
    });
    scheduleStoreCleanup(row.id);
  }
  if (active >= config.maxConcurrentRuns) {
    return {
      error: `Preflight is at capacity — ${active} run${active === 1 ? "" : "s"} executing (limit ${config.maxConcurrentRuns}). Try again when one finishes.`,
      status: 409,
    };
  }
  return null;
}

export async function launchRun(
  opts: LaunchOptions,
): Promise<{ runId: string; scenarioIds: string[] } | { error: string; status: number }> {
  const validated = await validateLaunch(opts);
  if ("error" in validated) return validated;
  const { provider } = validated;

  const guard = await guardSharedStore();
  if (guard) return guard;

  const resolved = await resolveSuite(opts.suite, opts.scenarioIds);
  if ("error" in resolved) return resolved;
  const { scenarioIds, scenarioMap } = resolved;

  const runId = `lrun_${Date.now().toString(36)}`;
  await resolved.seed(runId);
  // Re-check + create atomically: seeding above takes seconds, and two
  // concurrent launches must not both pass the earlier guard.
  try {
    await prisma.$transaction(async (tx) => {
      const runningCount = await tx.liveRun.count({ where: { status: "running" } });
      if (runningCount >= config.maxConcurrentRuns) throw new Error("RACE:capacity");
      await tx.liveRun.create({
        data: {
          id: runId,
          agentName: opts.agentName,
          agentKind: opts.agentKind,
          endpoint: opts.endpoint ?? null,
          provider: provider.name,
          suite: opts.suite,
          scenariosJson: JSON.stringify(scenarioIds),
          status: "running",
          // Resume context — everything except secrets.
          model: opts.model ?? null,
          systemPrompt: opts.systemPrompt ?? null,
          sandbox: opts.sandbox === true,
          authTokenUsed: !!opts.authToken,
        },
      });
    });
  } catch (err) {
    const race = err instanceof Error && err.message.startsWith("RACE:");
    if (race) {
      return {
        error: `Preflight just reached capacity (limit ${config.maxConcurrentRuns} concurrent runs). Try again when one finishes.`,
        status: 409,
      };
    }
    throw err;
  }

  // Fire and return — Mission Control follows via SSE + DB catch-up.
  void executeRun(runId, provider, opts, scenarioIds, scenarioMap).catch(async (err) => {
    log.error("harness", `run ${runId} crashed`, err);
    await prisma.liveRun.update({
      where: { id: runId },
      data: { status: "error", error: String(err), finishedAt: new Date() },
    });
    emit(runId, { type: "run_finished", status: "error", error: String(err) });
    scheduleStoreCleanup(runId);
    void advanceQueue();
  });

  return { runId, scenarioIds };
}

/* ------------------------------------------------------------------ */
/* Flight plans — one click, several runs, executed sequentially.     */
/* Each run keeps its own clean store environment, baseline, and      */
/* regression history; the plan is composition at the job level, not  */
/* a merged mega-run (security seeding poisons the store on purpose,  */
/* so layers must never share an environment).                        */
/* ------------------------------------------------------------------ */

/** Launch options for queued plan steps, held in-process only — auth
 * tokens are never persisted. If the server restarts mid-plan, the
 * remaining steps are closed out as errors instead of silently using
 * stale credentials. */
const planOpts = new Map<string, Omit<LaunchOptions, "suite">>();

export async function launchPlan(
  base: Omit<LaunchOptions, "suite">,
  suites: string[],
  planKind: string,
): Promise<
  | { planId: string; runIds: string[]; scenarioCounts: number[] }
  | { error: string; status: number }
> {
  if (suites.length === 0) return { error: "A plan needs at least one suite.", status: 400 };
  const validated = await validateLaunch(base);
  if ("error" in validated) return validated;
  const { provider } = validated;

  const guard = await guardSharedStore();
  if (guard) return guard;

  // Resolve every suite up front (ids only — seeding happens per step)
  // so a bad suite fails the whole plan before anything runs.
  const resolved: ResolvedSuite[] = [];
  for (const suite of suites) {
    const r = await resolveSuite(suite);
    if ("error" in r) return r;
    resolved.push(r);
  }

  const stamp = Date.now().toString(36);
  const planId = `plan_${stamp}`;
  const runIds = suites.map((_, i) => `lrun_${stamp}_${i + 1}`);
  try {
    await prisma.$transaction(async (tx) => {
      // One plan in flight at a time — its steps queue and start as
      // capacity frees up (runs are isolated, so unrelated single runs
      // can execute alongside).
      const queued = await tx.liveRun.findFirst({ where: { status: "queued" } });
      if (queued) throw new Error(`RACE:${queued.id}`);
      for (let i = 0; i < suites.length; i++) {
        await tx.liveRun.create({
          data: {
            id: runIds[i],
            agentName: base.agentName,
            agentKind: base.agentKind,
            endpoint: base.endpoint ?? null,
            provider: provider.name,
            suite: suites[i],
            scenariosJson: JSON.stringify(resolved[i].scenarioIds),
            status: "queued",
            planId,
            planKind,
            planStep: i + 1,
            // Resume context — a plan survives a restart, minus secrets.
            model: base.model ?? null,
            systemPrompt: base.systemPrompt ?? null,
            sandbox: base.sandbox === true,
            authTokenUsed: !!base.authToken,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("RACE:")) {
      return {
        error: `Another flight plan is already in flight (${err.message.slice(5)}) — one plan at a time.`,
        status: 409,
      };
    }
    throw err;
  }

  planOpts.set(planId, base);
  void advanceQueue();
  return { planId, runIds, scenarioCounts: resolved.map((r) => r.scenarioIds.length) };
}

/** Start the oldest queued run if the store is free. Called after every
 * run finishes (and after plan creation), so a queue always drains.
 * Queued steps whose in-process launch options were lost to a restart
 * are closed out as errors rather than left pending forever. */
export async function advanceQueue(): Promise<void> {
  for (;;) {
    let next: { id: string; suite: string; planId: string | null } | null = null;
    try {
      next = await prisma.$transaction(async (tx) => {
        const running = await tx.liveRun.findMany({
          where: { status: "running" },
          select: { planId: true },
        });
        if (running.length >= config.maxConcurrentRuns) return null;
        // A plan's steps run strictly in order — never start a step
        // while a sibling step is still executing.
        const runningPlans = new Set(running.map((r) => r.planId).filter(Boolean));
        const candidates = await tx.liveRun.findMany({
          where: { status: "queued" },
          orderBy: [{ startedAt: "asc" }, { planStep: "asc" }],
          select: { id: true, suite: true, planId: true },
        });
        const candidate = candidates.find((c) => !c.planId || !runningPlans.has(c.planId));
        if (!candidate) return null;
        await tx.liveRun.update({
          where: { id: candidate.id },
          data: { status: "running", startedAt: new Date() },
        });
        return candidate;
      });
    } catch (err) {
      log.error("harness", "advanceQueue transaction failed", err);
      return;
    }
    if (!next) return;

    // Prefer the in-process launch options (they carry auth tokens);
    // after a restart, rebuild from the persisted row instead so plans
    // survive deploys. Token-authed steps are the one thing that can't.
    const inProcess = next.planId ? planOpts.get(next.planId) : undefined;
    const row = await prisma.liveRun.findUnique({ where: { id: next.id } });
    const rebuilt = row ? optsFromRow(row) : null;
    const base = inProcess ?? (rebuilt ? { ...rebuilt } : undefined);
    if (!base) {
      await prisma.liveRun.update({
        where: { id: next.id },
        data: {
          status: "error",
          error:
            "Plan interrupted — this step's agent used a private auth token, which is never stored. Relaunch it individually.",
          finishedAt: new Date(),
        },
      });
      continue; // try the next queued step
    }

    const opts: LaunchOptions = { ...base, suite: next.suite };
    const validated = await validateLaunch(base);
    const resolvedSuite = await resolveSuite(next.suite);
    if ("error" in validated || "error" in resolvedSuite) {
      const msg = "error" in validated ? validated.error : (resolvedSuite as { error: string }).error;
      await prisma.liveRun.update({
        where: { id: next.id },
        data: { status: "error", error: msg, finishedAt: new Date() },
      });
      continue;
    }

    const runId = next.id;
    try {
      await resolvedSuite.seed(runId);
    } catch (err) {
      log.error("harness", `plan step ${runId} failed to seed`, err);
      await prisma.liveRun.update({
        where: { id: runId },
        data: { status: "error", error: "Store seeding failed for this step.", finishedAt: new Date() },
      });
      // A failed seed may have written a partial slice — clear it.
      scheduleStoreCleanup(runId);
      continue;
    }

    void executeRun(runId, validated.provider, opts, resolvedSuite.scenarioIds, resolvedSuite.scenarioMap).catch(
      async (err) => {
        log.error("harness", `run ${runId} crashed`, err);
        await prisma.liveRun.update({
          where: { id: runId },
          data: { status: "error", error: String(err), finishedAt: new Date() },
        });
        emit(runId, { type: "run_finished", status: "error", error: String(err) });
        scheduleStoreCleanup(runId);
        void advanceQueue();
      },
    );
    return; // the completion hook advances the rest
  }
}

async function executeRun(
  runId: string,
  provider: Provider,
  opts: LaunchOptions,
  scenarioIds: string[],
  scenarioMap: Map<string, Scenario>,
): Promise<void> {
  activeRuns.add(runId);
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

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    // Crash or success, this process is no longer executing the run —
    // a stale entry here would block future resume attempts.
    activeRuns.delete(runId);
  }

  await prisma.liveRun.update({
    where: { id: runId },
    data: { status: "complete", finishedAt: new Date() },
  });
  emit(runId, { type: "run_finished", status: "complete" });
  // A finished run frees capacity — drain any queued plan step.
  void advanceQueue();
  // Fire-and-forget housekeeping: store slice, webhook, retention.
  scheduleStoreCleanup(runId);
  void import("./notify").then((m) => m.notifyRunFinished(runId));
  void import("./retention").then((m) => m.pruneOldTranscripts());
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

    let judged = await withTimeout(body(), SCENARIO_TIMEOUT_MS, scenario.id);

    // Critical-severity fails get a second, independent judge pass —
    // a critical verdict should never rest on a single sample. Two
    // fails confirm it; a disagreement keeps the milder verdict,
    // flagged. (Skipped for the deterministic mock judge.)
    if (
      judged.verdict.outcome === "fail" &&
      judged.verdict.severity === "critical" &&
      provider.name !== "mock"
    ) {
      try {
        const second = await withTimeout(
          provider.judge(scenario, steps),
          SCENARIO_TIMEOUT_MS,
          `${scenario.id}(confirm)`,
        );
        tokens += second.tokens;
        costUsd += second.costUsd;
        if (second.verdict.outcome !== "fail") {
          second.verdict.failureReason =
            `Judges disagreed on a critical verdict (fail vs ${second.verdict.outcome}) — the milder verdict was kept. ` +
            (second.verdict.failureReason ?? "");
          judged = second;
        }
      } catch {
        // The confirmation pass is best-effort; the first verdict stands.
      }
    }
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
