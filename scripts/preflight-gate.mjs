#!/usr/bin/env node
/**
 * Preflight CI gate — launch a live run and fail the build if the agent
 * isn't ready. Zero dependencies; Node 18+.
 *
 *   node scripts/preflight-gate.mjs \
 *     --url https://preflight.example.com \
 *     --agent-name "Aurora Support" \
 *     --agent-kind openai \
 *     --endpoint https://api.example.com/v1 \
 *     --model gpt-4o \
 *     --suite standard \
 *     --min-score 85 \
 *     --max-regressions 0
 *
 * Flags:
 *   --url               Preflight server base URL (default http://localhost:3000)
 *   --agent-name        Agent name — regression baselines key on this + suite
 *   --agent-kind        reference | http | openai   (default reference)
 *   --endpoint          Agent endpoint URL (http/openai kinds)
 *   --model             Model name (openai kind)
 *   --auth-token        Bearer token for the agent endpoint
 *                       (or env PREFLIGHT_AGENT_TOKEN — prefer that in CI)
 *   --system-prompt     The agent's system prompt (openai kind)
 *   --suite             smoke | standard | extended | scale | exhaustive | max
 *                       | custom:<version>          (default smoke)
 *   --min-score         Gate: fail if pass-rate %% is below this
 *   --max-regressions   Gate: fail if more scenarios regressed vs baseline
 *                       (compares against the pinned baseline, else the
 *                       previous completed run of this agent + suite)
 *   --max-run-errors    Gate: fail on too many infra errors (default: don't)
 *   --set-baseline      Pin this run as the new baseline if the gate passes
 *                       (use on your main-branch job)
 *   --timeout-mins      Give up after this long (default 60)
 *
 * Exit codes: 0 gate passed · 1 gate failed · 2 usage/infra error.
 */

const args = parseArgs(process.argv.slice(2));

const cfg = {
  url: (args["url"] ?? "http://localhost:3000").replace(/\/+$/, ""),
  agentName: args["agent-name"] ?? "Reference agent",
  agentKind: args["agent-kind"] ?? "reference",
  endpoint: args["endpoint"],
  model: args["model"],
  authToken: args["auth-token"] ?? process.env.PREFLIGHT_AGENT_TOKEN,
  systemPrompt: args["system-prompt"],
  suite: args["suite"] ?? "smoke",
  minScore: numFlag("min-score"),
  maxRegressions: numFlag("max-regressions"),
  maxRunErrors: numFlag("max-run-errors"),
  setBaseline: "set-baseline" in args,
  timeoutMins: numFlag("timeout-mins") ?? 60,
};

if (cfg.minScore === undefined && cfg.maxRegressions === undefined && cfg.maxRunErrors === undefined) {
  fatal("Set at least one gate: --min-score, --max-regressions, or --max-run-errors.");
}
if ((cfg.agentKind === "http" || cfg.agentKind === "openai") && !cfg.endpoint) {
  fatal(`--agent-kind ${cfg.agentKind} needs --endpoint.`);
}

const isGithub = process.env.GITHUB_ACTIONS === "true";
const t0 = Date.now();

// ---------------------------------------------------------------- launch
log(`Launching ${cfg.suite} run for "${cfg.agentName}" (${cfg.agentKind}) at ${cfg.url}`);
const launch = await api("POST", "/api/live/runs", {
  agentName: cfg.agentName,
  agentKind: cfg.agentKind,
  endpoint: cfg.endpoint,
  model: cfg.model,
  authToken: cfg.authToken,
  systemPrompt: cfg.systemPrompt,
  suite: cfg.suite,
});
if (launch.error) fatal(`Launch refused: ${launch.error}`);
const runId = launch.runId;
log(`Run ${runId} started — ${launch.scenarioIds.length} scenarios`);

// ------------------------------------------------------------------ poll
const gateQuery = new URLSearchParams();
if (cfg.minScore !== undefined) gateQuery.set("minScore", String(cfg.minScore));
if (cfg.maxRegressions !== undefined) gateQuery.set("maxRegressions", String(cfg.maxRegressions));
if (cfg.maxRunErrors !== undefined) gateQuery.set("maxRunErrors", String(cfg.maxRunErrors));
const gatePath = `/api/live/runs/${runId}/gate?${gateQuery}`;

let gate;
let lastCompleted = -1;
for (;;) {
  if (Date.now() - t0 > cfg.timeoutMins * 60_000) {
    fatal(`Timed out after ${cfg.timeoutMins} minutes (run ${runId} still ${gate?.status ?? "running"}).`);
  }
  gate = await api("GET", gatePath);
  if (gate.error) fatal(`Gate check failed: ${gate.error}`);
  if (gate.status !== "running") break;
  if (gate.completed !== lastCompleted) {
    lastCompleted = gate.completed;
    log(`  ${gate.completed}/${gate.total} scenarios · score so far ${gate.score}%`);
  }
  await sleep(5000);
}

// ---------------------------------------------------------------- verdict
console.log("");
for (const check of gate.checks) {
  const mark = check.ok ? "✓" : "✗";
  console.log(`  ${mark} ${check.name} — ${check.detail}`);
  if (!check.ok && isGithub) {
    console.log(`::error title=Preflight gate::${check.name} failed — ${check.detail}`);
  }
}
console.log("");

if (gate.pass && cfg.setBaseline) {
  const pin = await api("POST", "/api/live/baseline", { runId });
  if (pin.error) log(`Warning: could not pin baseline: ${pin.error}`);
  else log(`Pinned ${runId} as the baseline for "${cfg.agentName}" · ${cfg.suite}`);
}

const reportUrl = `${cfg.url}/reports?run=${runId}`;
if (isGithub && process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  const rows = gate.checks
    .map((c) => `| ${c.ok ? "✅" : "❌"} | ${c.name} | ${c.detail} |`)
    .join("\n");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Preflight gate: ${gate.pass ? "PASSED" : "FAILED"} (score ${gate.score}%)\n\n` +
      `| | Check | Detail |\n|---|---|---|\n${rows}\n\n[Readiness report](${reportUrl})\n`,
  );
}

log(`${gate.pass ? "GATE PASSED" : "GATE FAILED"} — score ${gate.score}% · report: ${reportUrl}`);
process.exit(gate.pass ? 0 : 1);

// ----------------------------------------------------------------- utils
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) fatal(`Unexpected argument "${a}".`);
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "";
    }
  }
  return out;
}

function numFlag(name) {
  if (!(name in args)) return undefined;
  const n = Number(args[name]);
  if (!Number.isFinite(n)) fatal(`--${name} needs a number, got "${args[name]}".`);
  return n;
}

async function api(method, path, body) {
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error ?? `HTTP ${res.status}` };
    return json;
  } catch (err) {
    return { error: `${err?.message ?? err} (is Preflight reachable at ${cfg.url}?)` };
  }
}

function log(msg) {
  console.log(`[preflight] ${msg}`);
}

function fatal(msg) {
  console.error(`[preflight] ${msg}`);
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::error title=Preflight gate::${msg}`);
  }
  process.exit(2);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
