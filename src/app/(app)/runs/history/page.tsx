"use client";

import Link from "next/link";
import { useState } from "react";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { LiveEmpty } from "@/components/live-empty";
import { demoAgents } from "@/lib/fixtures/agents";
import { pastRuns } from "@/lib/fixtures/runs";
import { useMode } from "@/lib/mode";

/**
 * Run history — every run in the demo workspace, newest first, each one
 * openable. The run wall shows the latest run executing; this is the
 * ledger behind it.
 */
export default function RunHistoryPage() {
  const { mode } = useMode();
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  if (mode === "live") return <LiveEmpty surface="the run history" />;

  const rows = agentFilter ? pastRuns.filter((r) => r.agentId === agentFilter) : pastRuns;

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Run history</h1>
          <p className="mt-2 text-sm text-sub">
            {pastRuns.length} runs across {demoAgents.length} agents · Ecommerce Support Suite v2
          </p>
        </div>
        <ButtonLink href="/runs" variant="secondary">
          Watch the latest run →
        </ButtonLink>
      </div>

      {/* Agent filter */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Eyebrow className="mr-2">Agent</Eyebrow>
        <AgentChip label="All" active={agentFilter === null} onClick={() => setAgentFilter(null)} />
        {demoAgents.map((a) => (
          <AgentChip
            key={a.id}
            label={`${a.name} ${a.version}`}
            active={agentFilter === a.id}
            onClick={() => setAgentFilter(agentFilter === a.id ? null : a.id)}
          />
        ))}
      </div>

      {/* Ledger */}
      <div className="mt-6 overflow-hidden rounded-xl border border-edge">
        <div className="hidden border-b border-edge bg-surface px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-mut md:grid md:grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_3.5rem_5.5rem_5rem_4.5rem_5rem]">
          <span>Run</span>
          <span>Agent</span>
          <span className="text-right">Score</span>
          <span className="text-right">Δ</span>
          <span className="text-right">Passed</span>
          <span className="text-right">Fails</span>
          <span className="text-right">Cost</span>
          <span className="text-right">When</span>
        </div>
        <div className="divide-y divide-edge/60">
          {rows.map((r) => {
            const agent = demoAgents.find((a) => a.id === r.agentId);
            const above = agent ? r.score >= agent.threshold : false;
            return (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="focus-ring grid grid-cols-2 items-center gap-y-1 px-5 py-3 text-[13px] transition-colors hover:bg-surface md:grid-cols-[6.5rem_minmax(0,1fr)_5.5rem_3.5rem_5.5rem_5rem_4.5rem_5rem]"
              >
                <span className="font-mono text-[12px] text-mut">{r.id}</span>
                <span className="min-w-0 truncate text-ink">
                  {r.agentName} <span className="text-sub">{r.agentVersion}</span>
                </span>
                <span className="text-right">
                  <span
                    aria-hidden
                    className="mr-2 inline-block size-1.5 rounded-full align-middle"
                    style={{
                      background: above ? "var(--color-accent)" : "var(--color-fail)",
                    }}
                  />
                  <span className="numeral text-lg text-ink">{r.score}</span>
                  <span className="text-[12px] text-mut">%</span>
                </span>
                <span
                  className={`text-right font-mono text-[11px] tabular-nums ${
                    r.delta !== undefined && r.delta > 0
                      ? "text-accent"
                      : r.delta !== undefined && r.delta < 0
                        ? "text-fail"
                        : "text-mut"
                  }`}
                >
                  {r.delta === undefined || r.delta === 0
                    ? "—"
                    : r.delta > 0
                      ? `+${r.delta}`
                      : r.delta}
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums text-sub">
                  {r.passed}/{r.total}
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums">
                  <span className={r.failed > 0 ? "text-fail" : "text-mut"}>✗ {r.failed}</span>
                  {r.partial > 0 && <span className="text-warn"> ◐ {r.partial}</span>}
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums text-sub">
                  ${r.costUsd.toFixed(2)}
                </span>
                <span className="text-right font-mono text-[12px] text-mut">{r.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-[12px] text-mut">
        Scenario-level replays are retained for the workspace&apos;s most recent run — older
        runs keep their per-scenario outcomes and category results.
      </p>
    </div>
  );
}

function AgentChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`focus-ring h-8 cursor-pointer rounded-full border px-3.5 text-[12px] transition-colors duration-150 ${
        active
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-edge text-sub hover:border-mut hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
