"use client";

import Link from "next/link";
import { useState } from "react";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { LiveRunHistory } from "@/components/live-run-history";
import { demoAgents } from "@/lib/fixtures/agents";
import { pastRuns } from "@/lib/fixtures/runs";
import { toPastRun, useSessionRuns } from "@/lib/demo-runs";
import { useMode } from "@/lib/mode";
import styles from "@/components/evidence-ledger.module.css";

/**
 * Run history — every run in the workspace, newest first, each one
 * openable. The run wall shows the latest run executing; this is the
 * ledger behind it. Demo reads fixtures; live reads the database.
 */
export default function RunHistoryPage() {
  const { mode } = useMode();
  const sessionRuns = useSessionRuns();
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  if (mode === "live") return <LiveRunHistory />;

  // Fake tests run in this browser merge ahead of the fixture history.
  const merged = [
    ...sessionRuns.map((r) => toPastRun(r)),
    ...pastRuns,
  ].sort((a, b) => parseInt(b.id.slice(4), 10) - parseInt(a.id.slice(4), 10));
  const rows = agentFilter ? merged.filter((r) => r.agentId === agentFilter) : merged;
  const runsWithMisses = merged.filter((r) => r.failed + r.partial > 0).length;
  const activeAgent = agentFilter
    ? demoAgents.find((agent) => agent.id === agentFilter)
    : null;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <Eyebrow>Evidence ledger / runs</Eyebrow>
          <h1 className={styles.pageTitle}>Run history</h1>
          <div className={styles.pageMeta}>
            <span>Newest evidence first</span>
            <span className={styles.metaDivider} aria-hidden />
            <span>Ecommerce Support Suite v2</span>
            {activeAgent && (
              <>
                <span className={styles.metaDivider} aria-hidden />
                <span>Filtered to {activeAgent.name} {activeAgent.version}</span>
              </>
            )}
          </div>
        </div>
        <div className={`no-print ${styles.pageActions}`}>
          <ButtonLink href="/runs" variant="secondary">
            Watch the latest run →
          </ButtonLink>
        </div>
      </header>

      <div className={styles.summaryGrid} aria-label="Run history summary">
        <SummaryMetric label="Recorded runs" value={merged.length} hint="workspace ledger" />
        <SummaryMetric label="Agents" value={demoAgents.length} hint="represented here" />
        <SummaryMetric
          label="Runs with misses"
          value={runsWithMisses}
          hint={`${merged.length - runsWithMisses} fully clear`}
          tone={runsWithMisses > 0 ? "fail" : "accent"}
        />
      </div>

      {/* Agent filter */}
      <div className={`no-print ${styles.filterBar}`}>
        <div className={styles.filterControls}>
          <Eyebrow className="mr-1">Agent</Eyebrow>
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
        <span className={styles.filterCount}>{rows.length} shown</span>
      </div>

      {/* Ledger */}
      <div className={styles.ledger}>
        <div className={`${styles.ledgerHeader} ${styles.demoGrid}`}>
          <span>Agent · run</span>
          <span className={styles.ledgerMetric}>Score</span>
          <span className={styles.ledgerMetric}>Δ</span>
          <span className={styles.ledgerMetric}>Passed</span>
          <span className={styles.ledgerMetric}>Fails</span>
          <span className={styles.ledgerMetric}>Cost</span>
          <span className={styles.ledgerMetric}>When</span>
        </div>
        <div className={styles.ledgerRows}>
          {rows.map((r) => {
            const agent = demoAgents.find((a) => a.id === r.agentId);
            const above = agent ? r.score >= agent.threshold : false;
            return (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className={`focus-ring ${styles.ledgerRow} ${styles.demoGrid}`}
              >
                <span className={styles.ledgerPrimary}>
                  <span className={styles.ledgerAgent}>
                    {r.agentName} <span className="text-sub">{r.agentVersion}</span>
                  </span>
                  <span className={styles.ledgerRef}>{r.id}</span>
                </span>
                <span className={styles.ledgerMetric} data-label="Score">
                  <span
                    aria-hidden
                    className={styles.scoreSignal}
                    style={{
                      background: above ? "var(--color-accent)" : "var(--color-fail)",
                    }}
                  />
                  <span className={styles.ledgerScore}>{r.score}</span>
                  <span className="text-[12px] text-mut">%</span>
                </span>
                <span
                  data-label="Change"
                  className={`${styles.ledgerMetric} ${
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
                <span className={styles.ledgerMetric} data-label="Passed">
                  {r.passed}/{r.total}
                </span>
                <span className={styles.ledgerMetric} data-label="Misses">
                  <span className={r.failed > 0 ? "text-fail" : "text-mut"}>✗ {r.failed}</span>
                  {r.partial > 0 && <span className="text-warn"> ◐ {r.partial}</span>}
                </span>
                <span className={styles.ledgerMetric} data-label="Cost">
                  ${r.costUsd.toFixed(2)}
                </span>
                <span className={`${styles.ledgerMetric} text-mut`} data-label="When">{r.label}</span>
              </Link>
            );
          })}
          {rows.length === 0 && (
            <div className={styles.emptyRows}>No runs match this agent filter.</div>
          )}
        </div>
      </div>

      <p className={styles.ledgerFootnote}>
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
      aria-pressed={active}
      className={`focus-ring ${styles.chip} ${active ? styles.chipActive : ""}`}
    >
      {label}
    </button>
  );
}

function SummaryMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "accent" | "fail";
}) {
  return (
    <div className={styles.summaryCard}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue} data-tone={tone}>{value.toLocaleString()}</strong>
      <span className={styles.summaryHint}>{hint}</span>
    </div>
  );
}
