"use client";

import Link from "next/link";
import { use } from "react";
import { ButtonLink } from "@/components/ui";
import { LiveEmpty } from "@/components/live-empty";
import { Sparkline } from "@/components/sparkline";
import { demoAgents } from "@/lib/fixtures/agents";
import { categoryResults, runsByAgent, type PastRun } from "@/lib/fixtures/runs";
import { toPastRun, useSessionRuns } from "@/lib/demo-runs";
import { failingReplayId } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";
import { verdictFor } from "@/lib/types";
import styles from "../agents.module.css";

/**
 * Agent detail: the drill-down behind each agent card. Its readiness
 * trend, per-category performance, run history, and areas to fix first.
 * Demo-mode fixture data.
 */
export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useMode();
  const sessionRuns = useSessionRuns();
  const agent = demoAgents.find((candidate) => candidate.id === id);

  if (mode === "live") return <LiveEmpty surface="each agent's detail page" />;

  if (!agent) {
    return (
      <div className={styles.journey}>
        <div className={styles.ambient} aria-hidden />
        <div className={`${styles.shell} ${styles.notFound}`}>
          <div className={styles.notFoundInner}>
            <div className={styles.panelEyebrow}>Agent inventory</div>
            <h1>Agent not found</h1>
            <p>This agent isn&apos;t in the demo workspace.</p>
            <div>
              <ButtonLink href="/agents" variant="secondary">
                ← Back to agents
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const score = agent.scoreHistory.at(-1)!;
  const ready = score >= agent.threshold;
  const thresholdDelta = score - agent.threshold;
  const breakdown = agent.breakdown ?? [];
  const worst = [...breakdown]
    .filter((category) => category.pass < category.total)
    .sort((a, b) => a.pass / a.total - b.pass / b.total);
  // A replay link should show the failure it advertises; categories
  // with no failing replay on file get no link.
  const repScenario = failingReplayId;

  const fixtureHistory = runsByAgent.get(agent.id) ?? [];
  // Fake tests from this browser lead the list; the category-trend grid
  // stays fixture-only because per-category data is not stored for fake runs.
  const history = [
    ...sessionRuns.filter((run) => run.agentId === agent.id).map((run) => toPastRun(run)),
    ...fixtureHistory,
  ];

  return (
    <div className={styles.journey}>
      <div className={styles.ambient} aria-hidden />
      <div className={styles.shell}>
        <Link href="/agents" className={styles.backLink}>
          ← AGENT INVENTORY
        </Link>

        <header className={styles.detailHero}>
          <div className={styles.detailIdentity}>
            <div className={styles.detailStatus} data-ready={ready}>
              <span className={styles.agentDot} aria-hidden />
              {ready ? "Clears deployment threshold" : "Below deployment threshold"}
            </div>
            <h1>
              {agent.name} <span>{agent.version}</span>
            </h1>
            <div className={styles.detailMeta}>
              <span>{agent.connection}</span>
              <span>threshold {agent.threshold}%</span>
              <span>last run {agent.lastRun.agoLabel}</span>
            </div>
            {agent.note && <p className={styles.detailNote}>{agent.note}</p>}
            <div className={styles.detailActions}>
              <ButtonLink href="/reports" size="sm">
                Open readiness report →
              </ButtonLink>
              <ButtonLink href="/runs" variant="secondary" size="sm">
                View the run wall →
              </ButtonLink>
              <ButtonLink href="/benchmark" variant="secondary" size="sm">
                Compare versions →
              </ButtonLink>
            </div>
          </div>

          <div className={styles.detailScore}>
            <div className={styles.detailScoreValue}>
              {score}<span>%</span>
            </div>
            <div className={styles.detailVerdict} data-ready={ready}>
              {verdictFor(score)}
            </div>
            <Sparkline
              values={agent.scoreHistory}
              threshold={agent.threshold}
              width={160}
              height={40}
            />
          </div>

          <div className={styles.heroEvidence} aria-label="Latest run evidence">
            <div className={styles.heroEvidenceCell}>
              <span>Scenario coverage</span>
              <strong data-tone="accent">
                {agent.lastRun.passed} / {agent.lastRun.total} passed
              </strong>
            </div>
            <div className={styles.heroEvidenceCell}>
              <span>Critical failures</span>
              <strong data-tone={agent.lastRun.critical > 0 ? "fail" : "accent"}>
                {agent.lastRun.critical} found
              </strong>
            </div>
            <div className={styles.heroEvidenceCell}>
              <span>Threshold margin</span>
              <strong data-tone={thresholdDelta >= 0 ? "accent" : "fail"}>
                {thresholdDelta >= 0 ? "+" : ""}{thresholdDelta} points
              </strong>
            </div>
            <div className={styles.heroEvidenceCell}>
              <span>Evidence run</span>
              <strong>{agent.lastRun.runId}</strong>
            </div>
          </div>
        </header>

        <div className={styles.detailGrid}>
          <section className={styles.detailSection} aria-labelledby="category-performance-title">
            <div className={styles.detailSectionHeader}>
              <div>
                <div className={styles.sectionEyebrow}>Latest evaluation</div>
                <h2 id="category-performance-title">Category performance</h2>
              </div>
              <span>{agent.lastRun.passed} / {agent.lastRun.total} scenarios passed</span>
            </div>
            <div className={styles.surface}>
              {[...breakdown]
                .sort((a, b) => a.pass / a.total - b.pass / b.total)
                .map((category) => {
                  const pct = Math.round((category.pass / category.total) * 100);
                  const barClass =
                    pct === 100
                      ? styles.barPass
                      : pct >= 70
                        ? styles.barWarn
                        : styles.barFail;
                  const replay =
                    category.pass < category.total ? repScenario(category.category) : undefined;
                  const content = (
                    <>
                      <span className={styles.performanceCategory}>{category.category}</span>
                      <span
                        className={styles.performanceTrack}
                        role="progressbar"
                        aria-label={`${category.category} pass rate`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                      >
                        <span className={barClass} style={{ width: `${pct}%` }} />
                      </span>
                      <span className={styles.performanceCount}>
                        {category.pass}/{category.total}
                      </span>
                      <span className={styles.replayCue} aria-hidden={!replay}>
                        {replay ? "replay →" : ""}
                      </span>
                    </>
                  );

                  return replay ? (
                    <Link
                      key={category.category}
                      href={`/replay/${replay}`}
                      className={styles.performanceRow}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={category.category} className={styles.performanceRow}>
                      {content}
                    </div>
                  );
                })}
            </div>
          </section>

          {worst.length > 0 && (
            <section className={styles.detailSection} aria-labelledby="priorities-title">
              <div className={styles.detailSectionHeader}>
                <div>
                  <div className={styles.sectionEyebrow}>Priority queue</div>
                  <h2 id="priorities-title">Fix these first</h2>
                </div>
              </div>
              <div className={styles.priorityList}>
                {worst.slice(0, 3).map((category, index) => {
                  const replay = repScenario(category.category);
                  return (
                    <article key={category.category} className={styles.priorityCard}>
                      <span className={styles.priorityIndex}>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3>{category.category}</h3>
                        <p>
                          Fails {category.total - category.pass} of {category.total}, a{" "}
                          {Math.round(((category.total - category.pass) / category.total) * 100)}%
                          miss rate in this category.
                        </p>
                        {replay && <Link href={`/replay/${replay}`}>Watch a replay →</Link>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {fixtureHistory.length > 1 && (
            <section className={styles.detailSection} aria-labelledby="category-trend-title">
              <div className={styles.detailSectionHeader}>
                <div>
                  <div className={styles.sectionEyebrow}>Run over run</div>
                  <h2 id="category-trend-title">Category trend</h2>
                </div>
                <span className={styles.trendLegend}>
                  <TrendLegend glyph="✓" colorClass="text-accent" label="clean" />
                  <TrendLegend glyph="◐" colorClass="text-warn" label="degraded" />
                  <TrendLegend glyph="✕" colorClass="text-fail" label="failing" />
                </span>
              </div>
              <p className={styles.trendCopy}>
                Every category across the last {fixtureHistory.length} runs, oldest to newest.
                Each cell opens its run.
              </p>
              <div className={`${styles.surface} ${styles.trendSurface}`}>
                <CategoryTrend history={fixtureHistory} />
              </div>
            </section>
          )}

          <section className={styles.detailSection} aria-labelledby="run-history-title">
            <div className={styles.detailSectionHeader}>
              <div>
                <div className={styles.sectionEyebrow}>Evidence history</div>
                <h2 id="run-history-title">Run history</h2>
              </div>
              <Link href="/runs/history">all runs →</Link>
            </div>
            <div className={styles.surface}>
              {history.map((run) => {
                const above = run.score >= agent.threshold;
                const deltaTone =
                  run.delta !== undefined && run.delta > 0
                    ? "pass"
                    : run.delta !== undefined && run.delta < 0
                      ? "fail"
                      : undefined;
                return (
                  <Link key={run.id} href={`/runs/${run.id}`} className={styles.historyRow}>
                    <span className={styles.historyPrimary}>
                      <strong>{run.score}%</strong>
                      <span>{run.label}</span>
                      <small>{above ? "cleared the bar" : "below threshold"}</small>
                    </span>
                    <span className={styles.delta} data-tone={deltaTone}>
                      {run.delta === undefined || run.delta === 0
                        ? "—"
                        : run.delta > 0
                          ? `+${run.delta}`
                          : run.delta}
                    </span>
                    <span className={styles.historyId}>{run.id} →</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const trendTint = (pct: number) =>
  pct === 100
    ? { cell: "bg-accent/15 text-accent", glyph: "✓" }
    : pct >= 70
      ? { cell: "bg-warn/15 text-warn", glyph: "◐" }
      : { cell: "bg-fail/18 text-fail", glyph: "✕" };

function TrendLegend({
  glyph,
  colorClass,
  label,
}: {
  glyph: string;
  colorClass: string;
  label: string;
}) {
  return (
    <span>
      <span aria-hidden className={colorClass}>{glyph}</span>
      {label}
    </span>
  );
}

/** Category by run grid. Each cell links to the source run. */
function CategoryTrend({ history }: { history: PastRun[] }) {
  const chrono = [...history].reverse();
  const perRun = chrono.map(
    (run) => new Map(categoryResults(run.id).map((category) => [category.category, category])),
  );
  const latest = perRun[perRun.length - 1];
  const categories = [...latest.keys()].sort((a, b) => {
    const categoryA = latest.get(a)!;
    const categoryB = latest.get(b)!;
    return categoryA.pass / categoryA.total - categoryB.pass / categoryB.total;
  });

  return (
    <div className="min-w-[560px]">
      <div className="flex items-center gap-4">
        <span className="w-44 shrink-0" aria-hidden />
        <div className="flex gap-1">
          {chrono.map((run) => (
            <span
              key={run.id}
              title={`${run.id} · ${run.label}`}
              className="w-6 text-center font-mono text-[9px] text-mut"
            >
              {run.id.slice(-2)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1.5 space-y-1">
        {categories.map((category) => (
          <div key={category} className="flex items-center gap-4">
            <span className="w-44 shrink-0 truncate text-[13px] text-ink">{category}</span>
            <div className="flex gap-1">
              {chrono.map((run, index) => {
                const result = perRun[index].get(category)!;
                const pct = Math.round((result.pass / result.total) * 100);
                const tint = trendTint(pct);
                return (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    title={`${run.id} · ${category} · ${result.pass}/${result.total}`}
                    className="focus-ring rounded-[3px]"
                  >
                    <span
                      className={`flex size-6 items-center justify-center rounded-[3px] text-[9px] leading-none ${tint.cell}`}
                    >
                      {tint.glyph}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
