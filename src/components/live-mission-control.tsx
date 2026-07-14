"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Eyebrow } from "./ui";
import { LiveEmpty } from "./live-empty";
import { useLiveAgents } from "@/lib/live";
import {
  fetchProviderStatus,
  fetchRun,
  startRun,
  subscribeRun,
} from "@/lib/live-api";
import type { LiveCellResult, LiveRunSummary } from "@/lib/live-types";
import { scenarioById } from "@/lib/fixtures/scenarios";

/**
 * Live Mission Control: launch a real run against the simulated store
 * and watch the wall fill in from genuine results. Nothing here is
 * scripted; with no provider configured it shows a calm empty state.
 */

type CellState = "pending" | "running" | LiveCellResult["outcome"];

const cellStyles: Record<CellState, string> = {
  pending: "bg-raised/60",
  running: "bg-accent/35 animate-pulse-cell",
  pass: "bg-accent/12 text-accent [animation:settle-in_.35s_var(--ease-out-quad)_both]",
  fail: "bg-fail/18 text-fail [animation:fail-pop_.6s_var(--ease-out-quad)_both]",
  partial: "bg-warn/15 text-warn [animation:settle-in_.35s_var(--ease-out-quad)_both]",
  error:
    "bg-warn/10 text-warn ring-1 ring-inset ring-warn/40 [animation:settle-in_.35s_var(--ease-out-quad)_both]",
};

const cellGlyph: Record<string, string> = { pass: "✓", fail: "✗", partial: "◐", error: "!" };

export function MockBadge() {
  return (
    <span
      title="PREFLIGHT_LLM_KEY=mock — deterministic mock provider for development. Not a real evaluation."
      className="inline-flex h-6 items-center rounded-md border border-warn/50 bg-warn/10 px-2 font-mono text-[10px] tracking-[0.14em] text-warn"
    >
      MOCK PROVIDER
    </span>
  );
}

export function LiveMissionControl() {
  const router = useRouter();
  const { agents } = useLiveAgents();
  const [provider, setProvider] = useState<"anthropic" | "mock" | null | undefined>(undefined);
  const [run, setRun] = useState<LiveRunSummary | null>(null);
  const [cells, setCells] = useState<Map<string, CellState>>(new Map());
  const [results, setResults] = useState<Map<string, LiveCellResult>>(new Map());
  const [finished, setFinished] = useState<null | { status: string; error?: string }>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [agentChoice, setAgentChoice] = useState("reference");
  const [suite, setSuite] = useState<"smoke" | "full">("smoke");

  const attach = useCallback(async (runId: string) => {
    const summary = await fetchRun(runId);
    if (!summary) return;
    setRun(summary);
    const nextCells = new Map<string, CellState>();
    const nextResults = new Map<string, LiveCellResult>();
    for (const id of summary.scenarioIds) nextCells.set(id, "pending");
    for (const r of summary.results) {
      nextCells.set(r.scenarioId, r.outcome);
      nextResults.set(r.scenarioId, r);
    }
    setCells(nextCells);
    setResults(nextResults);
    setFinished(
      summary.status === "running"
        ? null
        : { status: summary.status, error: summary.error },
    );

    if (summary.status === "running") {
      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeRun(runId, (event) => {
        if (event.type === "scenario_started") {
          setCells((m) => new Map(m).set(event.scenarioId, "running"));
        } else if (event.type === "scenario_finished") {
          setCells((m) => new Map(m).set(event.result.scenarioId, event.result.outcome));
          setResults((m) => new Map(m).set(event.result.scenarioId, event.result));
        } else if (event.type === "run_finished") {
          setFinished({ status: event.status, error: event.error });
        }
      });
    }
  }, []);

  useEffect(() => {
    fetchProviderStatus().then(setProvider);
    const runParam = new URLSearchParams(window.location.search).get("run");
    if (runParam) void Promise.resolve().then(() => attach(runParam));
    return () => unsubscribeRef.current?.();
  }, [attach]);

  // Elapsed ticker while running.
  useEffect(() => {
    if (!run || finished) return;
    const started = new Date(run.startedAt).getTime();
    const id = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, [run, finished]);


  const launch = async () => {
    setLaunching(true);
    setLaunchError(null);
    const chosen = agents.find((a) => a.id === agentChoice);
    const response = await startRun({
      agentName: chosen?.name ?? "Reference agent",
      agentKind: chosen?.kind ?? "reference",
      endpoint: chosen?.endpoint,
      suite,
    });
    setLaunching(false);
    if ("error" in response) {
      setLaunchError(response.error);
      return;
    }
    window.history.replaceState(null, "", `/runs?run=${response.runId}`);
    await attach(response.runId);
  };

  const stats = useMemo(() => {
    const all = [...results.values()];
    const scored = all.filter((r) => r.outcome !== "error");
    const pass = scored.filter((r) => r.outcome === "pass").length;
    return {
      resolved: all.length,
      pass,
      fail: scored.filter((r) => r.outcome === "fail").length,
      partial: scored.filter((r) => r.outcome === "partial").length,
      errors: all.length - scored.length,
      passRate: scored.length ? Math.round((pass / scored.length) * 100) : 0,
      costUsd: all.reduce((a, r) => a + r.costUsd, 0),
    };
  }, [results]);

  if (provider === undefined) return null;
  if (provider === null) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24">
        <LiveEmpty surface="Mission Control" />
        <p className="mt-6 text-center font-mono text-[12px] leading-relaxed text-mut">
          Live runs also need an LLM provider on the server:
          <br />
          set <span className="text-sub">PREFLIGHT_LLM_KEY</span> (or{" "}
          <span className="text-sub">ANTHROPIC_API_KEY</span>) and restart.
        </p>
      </div>
    );
  }

  // ------------------------------------------------- Launcher
  if (!run) {
    return (
      <div className="mx-auto max-w-xl px-8 py-16">
        <div className="flex items-center justify-between">
          <Eyebrow>Live run</Eyebrow>
          {provider === "mock" ? (
            <MockBadge />
          ) : (
            <span className="font-mono text-[11px] text-mut">claude-opus-4-8</span>
          )}
        </div>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
          Run an agent against the store
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-sub">
          The harness resets and reseeds the simulated store, then runs each
          scenario as a real multi-turn conversation — an LLM customer persona
          against your agent, with a judge scoring every transcript.
        </p>

        <Card className="mt-8 space-y-6">
          <label className="block space-y-2">
            <Eyebrow>Agent under test</Eyebrow>
            <select
              className="focus-ring w-full rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none"
              value={agentChoice}
              onChange={(e) => setAgentChoice(e.target.value)}
            >
              <option value="reference">Reference agent (built-in, deliberately imperfect)</option>
              {agents
                .filter((a) => a.kind !== "reference")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.kind.toUpperCase()} {a.endpoint ?? ""}
                  </option>
                ))}
            </select>
          </label>

          <div className="space-y-2">
            <Eyebrow>Suite</Eyebrow>
            <div className="flex gap-3">
              <SuiteOption
                active={suite === "smoke"}
                onClick={() => setSuite("smoke")}
                title="Smoke · 24 scenarios"
                body="Every category incl. the traps. Minutes, not hours."
              />
              <SuiteOption
                active={suite === "full"}
                onClick={() => setSuite("full")}
                title="Full · 200 scenarios"
                body="The complete suite. Slow and costly — meant for sign-off."
              />
            </div>
          </div>

          {launchError && (
            <p className="rounded-lg border border-warn/40 bg-warn/8 p-3 text-[13px] text-warn">
              {launchError}
            </p>
          )}

          <Button className="w-full" onClick={launch} disabled={launching}>
            {launching ? "Seeding store…" : "Start run"}
          </Button>
        </Card>

        <p className="mt-4 text-center text-[12px] text-mut">
          One run at a time — the store is shared and reseeded per run.
        </p>
      </div>
    );
  }

  // ------------------------------------------------- The wall
  const cols = run.scenarioIds.length <= 32 ? 8 : 20;
  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 border-b border-edge bg-raised/95 px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Eyebrow>Live run {run.id}</Eyebrow>
              {run.provider === "mock" && <MockBadge />}
            </div>
            <div className="mt-1 text-[15px] font-medium text-ink">
              {run.agentName}
              <span className="ml-2 text-sub">
                · {run.suite === "smoke" ? "Smoke suite · 24 scenarios" : "Full suite · 200 scenarios"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-8 font-mono text-sm tabular-nums">
            <HeaderStat label="Pass rate" value={`${stats.passRate}%`} accent />
            <HeaderStat label="Complete" value={`${stats.resolved}/${run.scenarioIds.length}`} />
            <HeaderStat
              label="Elapsed"
              value={`${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")}`}
            />
            <HeaderStat label="Cost" value={`$${stats.costUsd.toFixed(2)}`} />
            <Button variant="secondary" size="sm" onClick={() => { setRun(null); setFinished(null); setResults(new Map()); window.history.replaceState(null, "", "/runs"); }}>
              New run
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 py-10">
        <div
          className="mx-auto grid w-fit gap-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, 44px)` }}
          role="grid"
          aria-label="Live scenario wall"
        >
          {run.scenarioIds.map((scenarioId) => {
            const state = cells.get(scenarioId) ?? "pending";
            const resolved = state !== "pending" && state !== "running";
            const s = scenarioById.get(scenarioId);
            const cell = (
              <span
                className={`flex size-11 items-center justify-center rounded-[5px] text-[12px] leading-none transition-colors duration-300 ${cellStyles[state]} ${resolved ? "cursor-pointer hover:ring-1 hover:ring-mut" : ""}`}
              >
                {resolved ? cellGlyph[state] : null}
              </span>
            );
            const title = `${scenarioId} · ${s?.name ?? ""} · ${state}`;
            return resolved ? (
              <button
                key={scenarioId}
                title={title}
                onClick={() => router.push(`/replay/${scenarioId}?run=${run.id}`)}
                className="focus-ring rounded-[5px]"
              >
                {cell}
              </button>
            ) : (
              <div key={scenarioId} title={title}>
                {cell}
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-8 flex max-w-2xl items-center justify-between text-[13px]">
          <div className="flex items-center gap-5 text-sub">
            <Legend color="var(--color-accent)" glyph="✓" label={`Pass ${stats.pass}`} />
            <Legend color="var(--color-fail)" glyph="✗" label={`Fail ${stats.fail}`} />
            <Legend color="var(--color-warn)" glyph="◐" label={`Partial ${stats.partial}`} />
            <Legend color="var(--color-warn)" glyph="!" label={`Run error ${stats.errors}`} />
          </div>
          {finished && (
            <Link
              href={`/reports?run=${run.id}`}
              className="focus-ring animate-fade-in rounded-md text-accent hover:underline"
            >
              Run {finished.status} — view the readiness report →
            </Link>
          )}
        </div>

        {finished?.error && (
          <p className="mx-auto mt-4 max-w-2xl rounded-lg border border-warn/40 bg-warn/8 p-3 text-center text-[13px] text-warn">
            {finished.error}
          </p>
        )}
      </div>
    </div>
  );
}

function SuiteOption({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring flex-1 rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${
        active ? "border-accent/50 bg-raised" : "border-edge hover:border-mut"
      }`}
    >
      <div className="text-[13px] font-medium text-ink">{title}</div>
      <div className="mt-1 text-[12px] leading-relaxed text-sub">{body}</div>
    </button>
  );
}

function HeaderStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="eyebrow">{label}</div>
      <div className={`mt-0.5 ${accent ? "text-accent" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function Legend({ color, glyph, label }: { color: string; glyph: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden style={{ color }}>
        {glyph}
      </span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
