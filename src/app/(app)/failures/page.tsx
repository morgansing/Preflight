"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Eyebrow, OutcomeChip, SeverityLabel } from "@/components/ui";
import { LiveEmpty } from "@/components/live-empty";
import { demoAgents } from "@/lib/fixtures/agents";
import { latestRunOutcomes } from "@/lib/fixtures/runs";
import { demoOutcomes, scenarioById } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";
import type { Outcome, Severity } from "@/lib/types";

/**
 * Failures — every scenario any agent missed on its latest run, in one
 * triage list. The dashboard's "open critical fails" number, opened.
 */

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

interface FailureRow {
  agentId: string;
  agentLabel: string;
  scenarioId: string;
  name: string;
  category: string;
  severity: Severity;
  outcome: Outcome;
  /** Set when a replay exists that actually shows this scenario failing. */
  replayHref?: string;
}

function buildRows(): FailureRow[] {
  const rows: FailureRow[] = [];
  for (const agent of demoAgents) {
    const outcomes = latestRunOutcomes(agent.id);
    if (!outcomes) continue;
    for (const [scenarioId, outcome] of outcomes) {
      if (outcome === "pass") continue;
      const s = scenarioById.get(scenarioId);
      if (!s) continue;
      rows.push({
        agentId: agent.id,
        agentLabel: `${agent.name} ${agent.version}`,
        scenarioId,
        name: s.name,
        category: s.category,
        severity: s.severity,
        outcome,
        replayHref:
          demoOutcomes.get(scenarioId) !== "pass" ? `/replay/${scenarioId}` : undefined,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      SEV_ORDER[a.severity] - SEV_ORDER[b.severity] ||
      a.scenarioId.localeCompare(b.scenarioId) ||
      a.agentLabel.localeCompare(b.agentLabel),
  );
}

export default function FailuresPage() {
  const { mode } = useMode();
  if (mode === "live") return <LiveEmpty surface="the failures list" />;
  return (
    <Suspense>
      <FailuresView />
    </Suspense>
  );
}

function FailuresView() {
  const params = useSearchParams();
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(() => {
    const s = params.get("severity");
    return s && SEVERITIES.includes(s as Severity) ? (s as Severity) : null;
  });

  const all = useMemo(() => buildRows(), []);
  const rows = all.filter(
    (r) =>
      (!agentFilter || r.agentId === agentFilter) &&
      (!severityFilter || r.severity === severityFilter),
  );
  const criticalFails = all.filter(
    (r) => r.severity === "critical" && r.outcome === "fail",
  ).length;

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="font-display text-3xl tracking-tight text-ink">Failures</h1>
      <p className="mt-2 text-sm text-sub">
        {all.length} open misses across {demoAgents.length} agents&apos; latest runs ·{" "}
        <span className="text-fail">{criticalFails} critical fails</span>
      </p>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Eyebrow className="mr-2">Agent</Eyebrow>
        <Chip label="All" active={agentFilter === null} onClick={() => setAgentFilter(null)} />
        {demoAgents.map((a) => (
          <Chip
            key={a.id}
            label={`${a.name} ${a.version}`}
            active={agentFilter === a.id}
            onClick={() => setAgentFilter(agentFilter === a.id ? null : a.id)}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Eyebrow className="mr-2">Severity</Eyebrow>
        <Chip
          label="All"
          active={severityFilter === null}
          onClick={() => setSeverityFilter(null)}
        />
        {SEVERITIES.map((s) => (
          <Chip
            key={s}
            label={s}
            active={severityFilter === s}
            onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
          />
        ))}
      </div>

      {/* The list */}
      <div className="mt-6 rounded-xl border border-edge">
        <div className="sticky top-14 z-10 hidden rounded-t-xl border-b border-edge bg-surface px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-mut md:grid md:grid-cols-[5.5rem_minmax(0,1fr)_11rem_9rem_5.5rem_6.5rem_5.5rem] lg:top-0">
          <span>ID</span>
          <span>Scenario</span>
          <span>Agent</span>
          <span>Category</span>
          <span>Severity</span>
          <span>Outcome</span>
          <span className="text-right">Replay</span>
        </div>
        <div className="divide-y divide-edge/60">
          {rows.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-mut">
              Nothing matches these filters.
            </p>
          )}
          {rows.map((r, i) => (
            <div
              key={`${r.agentId}:${r.scenarioId}`}
              style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
              className="animate-fade-up grid grid-cols-2 items-center gap-y-1 px-5 py-2.5 text-[13px] md:grid-cols-[5.5rem_minmax(0,1fr)_11rem_9rem_5.5rem_6.5rem_5.5rem]"
            >
              <Link
                href={`/scenarios/${r.scenarioId}`}
                className="focus-ring rounded font-mono text-[12px] text-mut hover:text-accent"
              >
                {r.scenarioId}
              </Link>
              <span className="min-w-0 truncate text-ink" title={r.name}>
                {r.name}
              </span>
              <Link
                href={`/agents/${r.agentId}`}
                className="focus-ring min-w-0 truncate rounded text-sub hover:text-accent"
              >
                {r.agentLabel}
              </Link>
              <span className="min-w-0 truncate text-sub">{r.category}</span>
              <SeverityLabel severity={r.severity} />
              <span>
                <OutcomeChip outcome={r.outcome} />
              </span>
              <span className="text-right">
                {r.replayHref && (
                  <Link
                    href={r.replayHref}
                    className="focus-ring rounded font-mono text-[11px] text-accent hover:underline"
                  >
                    watch →
                  </Link>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[12px] text-mut">
        Replay links open transcripts that show the failure; misses without one are
        outside the retained demo run.
      </p>
    </div>
  );
}

function Chip({
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
      aria-pressed={active}
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
