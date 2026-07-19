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
 *   --sandbox           Run the deterministic sandbox (mock provider, no
 *                       key, no cost) — verifies CI wiring, not the agent
 *   --comment-file      Write a markdown verdict (checks + scenario-level
 *                       regressions) to this path — the Preflight GitHub
 *                       Action posts it as a sticky PR comment
 *   --timeout-mins      Give up after this long (default 60)
 *
 * In GitHub Actions the script also writes a job step summary and sets
 * step outputs: pass, score, run-id, report-url.
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
  sandbox: "sandbox" in args,
  commentFile: args["comment-file"],
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
  sandbox: cfg.sandbox,
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

// Scenario-level deltas vs the baseline — the part a reviewer actually
// reads on a PR. Absent on the first run of an agent + suite.
let regression = null;
if (gate.status === "complete") {
  const r = await api("GET", `/api/live/runs/${runId}/regression`);
  if (!r.error && r.report) regression = r.report;
}

const reportUrl = `${cfg.url}/reports?run=${runId}`;
const runUrl = `${cfg.url}/runs/${runId}`;
const markdown = gateMarkdown();

const fs = await import("node:fs");
if (isGithub && process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
}
if (isGithub && process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `pass=${gate.pass}\nscore=${gate.score}\nrun-id=${runId}\nreport-url=${reportUrl}\n`,
  );
}
if (cfg.commentFile) {
  // The marker keeps the PR comment sticky: the Action finds and updates
  // the existing comment for this agent + suite instead of stacking new
  // ones on every push.
  const marker = `<!-- preflight-gate:${cfg.agentName}:${cfg.suite} -->`;
  fs.writeFileSync(cfg.commentFile, `${marker}\n${markdown}\n`);
  log(`Wrote PR comment markdown to ${cfg.commentFile}`);
}

log(`${gate.pass ? "GATE PASSED" : "GATE FAILED"} — score ${gate.score}% · report: ${reportUrl}`);
process.exit(gate.pass ? 0 : 1);

// ------------------------------------------------------------- markdown
function gateMarkdown() {
  const scored = gate.counts.pass + gate.counts.fail + gate.counts.partial;
  const lines = [];
  lines.push(
    `## ${gate.pass ? "✅" : "❌"} Preflight gate ${gate.pass ? "passed" : "failed"} — ${cfg.agentName} · ${cfg.suite}${cfg.sandbox ? " · SANDBOX" : ""}`,
  );
  lines.push("");
  lines.push(
    `**${gate.score}%** — ${gate.counts.pass}/${scored} passed · ${gate.counts.fail} failed · ` +
      `${gate.counts.partial} partial${gate.counts.error ? ` · ${gate.counts.error} run errors (excluded)` : ""}` +
      ` — [readiness report](${reportUrl}) · [run ${runId}](${runUrl})`,
  );
  lines.push("");
  lines.push("| | Check | Detail |");
  lines.push("|---|---|---|");
  for (const c of gate.checks) lines.push(`| ${c.ok ? "✅" : "❌"} | ${c.name} | ${c.detail} |`);

  if (regression) {
    lines.push("");
    lines.push(
      `**vs ${regression.baselinePinned ? "pinned baseline" : "previous run"} ${regression.baselineRunId}:** ` +
        `${regression.baselineScore}% → ${regression.candidateScore}% · ` +
        `${regression.regressions.length} regressed · ${regression.improvements.length} recovered · ` +
        `${regression.stillFailing} still failing`,
    );
    if (regression.regressions.length > 0) {
      lines.push("");
      lines.push("**Newly broken:**");
      for (const d of regression.regressions.slice(0, 10)) {
        const reason = d.failureReason ? ` — ${d.failureReason}` : "";
        lines.push(
          `- ❌ **${d.name ?? d.scenarioId}** (${d.severity}) ${d.from} → ${d.to}${reason} · [replay](${cfg.url}/replay/${d.scenarioId}?run=${runId})`,
        );
      }
      if (regression.regressions.length > 10) {
        lines.push(`- …and ${regression.regressions.length - 10} more — [full diff](${runUrl})`);
      }
    }
    if (regression.improvements.length > 0) {
      const shown = regression.improvements
        .slice(0, 5)
        .map((d) => d.name ?? d.scenarioId)
        .join(", ");
      const extra = regression.improvements.length > 5 ? ` +${regression.improvements.length - 5} more` : "";
      lines.push("");
      lines.push(`**Recovered:** ${shown}${extra}`);
    }
  }
  return lines.join("\n");
}

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
    // PREFLIGHT_API_TOKEN authenticates this headless caller once the
    // server has auth enabled; without auth the header is ignored.
    const apiToken = process.env.PREFLIGHT_API_TOKEN;
    const res = await fetch(`${cfg.url}${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {}),
      },
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
