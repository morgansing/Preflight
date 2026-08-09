"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { OutcomeChip, SeverityLabel } from "@/components/ui";
import styles from "@/components/evidence-browser.module.css";
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
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={`${styles.kicker} ${styles.failureKicker}`}>
            Latest-run triage
          </div>
          <h1 className={styles.pageTitle}>
            Find the miss.
            <br />
            <em>Open the proof.</em>
          </h1>
          <p className={styles.pageSubtitle}>
            Every scenario an agent missed on its latest run, ordered by
            severity and connected to the retained replay when one exists.
          </p>
        </div>
        <div className={styles.headerSide}>
          <div className={styles.failureSummary} aria-label="Failure triage summary">
            <div className={styles.failureMetric}>
              <span className={styles.metricLabel}>Open misses</span>
              <strong className={styles.metricValue}>{all.length}</strong>
              <span className={styles.metricNote}>latest runs</span>
            </div>
            <div className={styles.failureMetric}>
              <span className={styles.metricLabel}>Critical fails</span>
              <strong className={`${styles.metricValue} ${styles.metricValueFail}`}>
                {criticalFails}
              </strong>
              <span className={styles.metricNote}>highest priority</span>
            </div>
            <div className={styles.failureMetric}>
              <span className={styles.metricLabel}>Agents</span>
              <strong className={styles.metricValue}>{demoAgents.length}</strong>
              <span className={styles.metricNote}>latest runs compared</span>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.filterPanel} aria-labelledby="failure-filters-title">
        <div className={styles.panelTopbar}>
          <span className={styles.panelKicker} id="failure-filters-title">
            <strong>01</strong> · Narrow the triage queue
          </span>
          <span className={styles.panelSummary}>
            {rows.length} / {all.length} visible
          </span>
        </div>
        <div className={styles.filterBody}>
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Agent</div>
            <div className={styles.chipRail}>
              <Chip
                label="All"
                active={agentFilter === null}
                onClick={() => setAgentFilter(null)}
              />
              {demoAgents.map((agent) => (
                <Chip
                  key={agent.id}
                  label={`${agent.name} ${agent.version}`}
                  active={agentFilter === agent.id}
                  onClick={() =>
                    setAgentFilter(agentFilter === agent.id ? null : agent.id)
                  }
                />
              ))}
            </div>
          </div>
          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Severity</div>
            <div className={styles.chipRail}>
              <Chip
                label="All"
                active={severityFilter === null}
                onClick={() => setSeverityFilter(null)}
              />
              {SEVERITIES.map((severity) => (
                <Chip
                  key={severity}
                  label={severity}
                  active={severityFilter === severity}
                  onClick={() =>
                    setSeverityFilter(severityFilter === severity ? null : severity)
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.failureList} aria-labelledby="failure-results-title">
        <div className={styles.tableTopbar}>
          <span className={styles.tableTitle} id="failure-results-title">
            Open misses
          </span>
          <span className={styles.panelSummary}>{rows.length} in this view</span>
        </div>
        <div className={styles.failureHeader} aria-hidden>
          <span>ID</span>
          <span>Scenario</span>
          <span>Agent</span>
          <span>Category</span>
          <span>Severity</span>
          <span>Outcome</span>
          <span className="text-right">Replay</span>
        </div>
        <div className={styles.failureRows}>
          {rows.length === 0 && (
            <p className={styles.failureEmpty}>
              Nothing matches these filters.
            </p>
          )}
          {rows.map((r) => (
            <div
              key={`${r.agentId}:${r.scenarioId}`}
              className={styles.failureRow}
            >
              <Link
                href={`/scenarios/${r.scenarioId}`}
                className={styles.failureId}
              >
                {r.scenarioId}
              </Link>
              <span className={styles.failureName} title={r.name}>
                {r.name}
              </span>
              <Link
                href={`/agents/${r.agentId}`}
                className={styles.failureAgentLink}
              >
                <span className={styles.mobileLabel}>Agent</span>
                {r.agentLabel}
              </Link>
              <span className={styles.failureCategory}>
                <span className={styles.mobileLabel}>Category</span>
                {r.category}
              </span>
              <span className={styles.failureSeverity}>
                <SeverityLabel severity={r.severity} />
              </span>
              <span className={styles.failureOutcome}>
                <OutcomeChip outcome={r.outcome} />
              </span>
              <span className={styles.replayCell}>
                {r.replayHref ? (
                  <Link
                    href={r.replayHref}
                    className={styles.replayLink}
                  >
                    watch →
                  </Link>
                ) : (
                  <span className={styles.notRetained}>not retained</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className={styles.listNote}>
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={styles.chip}
    >
      {label}
    </button>
  );
}
