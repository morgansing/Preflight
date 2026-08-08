"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ActivationChecklist } from "./activation-checklist";
import styles from "./dashboard.module.css";
import { MockBadge } from "./live-mission-control";
import { ReadinessCard } from "./readiness-card";
import { ButtonLink, Eyebrow, LoadError, Skeleton } from "./ui";
import { strengthsAndWeaknesses } from "@/lib/live-analyze";
import { fetchRun, fetchRuns } from "@/lib/live-api";
import { scoreOf, type LiveRunListItem, type LiveRunSummary } from "@/lib/live-types";
import { suiteLabel } from "@/lib/suite-tiers";

export function LiveDashboard() {
  // undefined = loading · null = fetch failed · [] = empty workspace.
  const [runs, setRuns] = useState<LiveRunListItem[] | null | undefined>(undefined);
  const [latest, setLatest] = useState<LiveRunSummary | null>(null);
  const [latestDetailFailed, setLatestDetailFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await fetchRuns();
      if (!list) return { list: null, full: null, detailFailed: false };
      const latestComplete = list.find((run) => run.status === "complete");
      const full = latestComplete ? await fetchRun(latestComplete.id) : null;
      return { list, full, detailFailed: Boolean(latestComplete && !full) };
    })().then(({ list, full, detailFailed }) => {
      if (!alive) return;
      setRuns(list);
      setLatest(full);
      setLatestDetailFailed(detailFailed);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (runs === undefined) return <DashboardLoading />;

  if (runs === null) {
    return (
      <section className={styles.errorStage}>
        <div className={styles.stateEyebrow}>Telemetry interrupted</div>
        <LoadError what="live runs" onRetry={() => setAttempt((current) => current + 1)} />
      </section>
    );
  }

  if (runs.length === 0) return <EmptyDashboard runs={runs} />;

  const strengths = latest ? strengthsAndWeaknesses(latest) : null;

  return (
    <>
      <LiveStats runs={runs} latest={latest} />

      <div className={styles.activationStage}>
        <ActivationChecklist runs={runs} />
      </div>

      <section className={styles.contentSection}>
        <div className={styles.sectionHeader}>
          <div>
            <Eyebrow>Evaluation stream</Eyebrow>
            <h2>Recent runs</h2>
            <p>Live progress and settled evidence, ordered by the latest start.</p>
          </div>
          <Link href="/runs/history" className={styles.textLink}>
            View run history <span aria-hidden>→</span>
          </Link>
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.runList}>
            {runs.slice(0, 6).map((run, index) => (
              <LiveRunCard key={run.id} run={run} index={index} />
            ))}
            <div className={styles.thresholdKey}>
              <span><i aria-hidden /> Scenario progress</span>
              <span>Newest runs first</span>
            </div>
          </div>

          <aside className={styles.readinessColumn}>
            {latest && strengths ? (
              <ReadinessCard
                score={scoreOf(latest.results)}
                strengths={strengths.strengths}
                weaknesses={strengths.weaknesses}
                wallHref={`/runs/${latest.id}`}
                meta={`Run ${latest.id} · ${latest.results.length} scenarios · provider ${latest.provider}`}
                className={styles.readinessCard}
              />
            ) : latestDetailFailed ? (
              <LoadError
                what="the latest readiness evidence"
                onRetry={() => setAttempt((current) => current + 1)}
              />
            ) : (
              <PendingReadiness runs={runs} />
            )}
          </aside>
        </div>
      </section>
    </>
  );
}

function LiveStats({
  runs,
  latest,
}: {
  runs: LiveRunListItem[];
  latest: LiveRunSummary | null;
}) {
  const agentCount = new Set(runs.map((run) => run.agentName)).size;
  const running = runs.filter((run) => run.status === "running").length;
  const resolved = runs.reduce(
    (sum, run) => sum + run.counts.pass + run.counts.fail + run.counts.partial + run.counts.error,
    0,
  );
  const latestComplete = runs.find((run) => run.status === "complete");
  const latestScore = latest ? scoreOf(latest.results) : latestComplete?.score;

  const stats: Array<{
    label: string;
    value: string;
    detail: string;
    href: string;
    tone?: "accent";
  }> = [
    {
      label: "Agents evaluated",
      value: String(agentCount),
      detail: "In recorded runs",
      href: "/agents",
    },
    {
      label: "Running now",
      value: String(running),
      detail: running > 0 ? "Evaluations in flight" : "Workspace is settled",
      href: "/runs",
      tone: running > 0 ? "accent" : undefined,
    },
    {
      label: "Scenarios resolved",
      value: resolved.toLocaleString(),
      detail: "Across visible runs",
      href: "/runs/history",
    },
    {
      label: "Latest readiness",
      value: latestScore === undefined ? "—" : `${latestScore}%`,
      detail: latestComplete ? `Run ${latestComplete.id}` : "Awaiting a completed run",
      href: latestComplete ? `/reports?run=${latestComplete.id}` : "/runs",
      tone: latestScore !== undefined && latestScore >= 90 ? "accent" : undefined,
    },
  ];

  return (
    <section className={styles.metrics} aria-label="Live workspace summary">
      <div className={styles.metricsHeader}>
        <span>Current signal</span>
        <span>{running > 0 ? `${running} evaluation${running === 1 ? "" : "s"} in flight` : "All runs settled"}</span>
      </div>
      <div className={styles.metricGrid}>
        {stats.map((stat, index) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`focus-ring ${styles.metricLink}`}
            style={{ animationDelay: `${80 + index * 55}ms` }}
          >
            <span className={styles.metricIndex}>0{index + 1}</span>
            <span className={styles.metricLabel}>{stat.label}</span>
            <strong className={`${styles.metricValue} ${stat.tone ? styles.accentValue : ""}`}>
              {stat.value}
            </strong>
            <small>{stat.detail}</small>
            <span className={styles.metricArrow} aria-hidden>↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LiveRunCard({ run, index }: { run: LiveRunListItem; index: number }) {
  const running = run.status === "running" || run.status === "queued";
  const resolved = run.counts.pass + run.counts.fail + run.counts.partial + run.counts.error;
  const progress = run.total === 0 ? 0 : Math.min(100, (resolved / run.total) * 100);
  const route = running ? `/runs?run=${run.id}` : `/reports?run=${run.id}`;
  const stateClass = run.status === "error"
    ? styles.warnDot
    : running || run.score >= 90
      ? styles.passDot
      : styles.failDot;

  return (
    <Link
      href={route}
      className={`focus-ring ${styles.agentLink}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <article className={styles.liveRunCard}>
        <div className={styles.agentMain}>
          <div className={styles.agentIdentity}>
            <span
              aria-hidden
              className={`${styles.statusDot} ${stateClass} ${running ? styles.pulsingDot : ""}`}
            />
            <div className={styles.agentName}>
              <strong>{run.agentName}</strong>
              <span>{run.id}</span>
            </div>
            {run.provider === "mock" && <MockBadge />}
          </div>
          <p className={styles.suiteName}>{suiteLabel(run.suite, run.total)}</p>
          <div className={styles.agentMeta}>
            <span>{run.provider}</span>
            <span>
              {running
                ? run.status === "queued" ? "queued" : "running now"
                : new Date(run.startedAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
            </span>
          </div>
        </div>

        <div className={styles.liveScore}>
          <div>
            <span className={styles.scoreNumber}>{run.score}</span>
            <span className={styles.scoreUnit}>%</span>
          </div>
          <small>{running ? `${resolved.toLocaleString()} / ${run.total.toLocaleString()}` : "Readiness"}</small>
        </div>

        <div className={styles.runEvidence}>
          <div className={styles.outcomeCounts}>
            <span className={styles.clear}>✓ {run.counts.pass.toLocaleString()} pass</span>
            <span className={styles.critical}>× {run.counts.fail.toLocaleString()} fail</span>
            <span className={styles.partial}>◐ {run.counts.partial.toLocaleString()} partial</span>
            {run.counts.error > 0 && <span className={styles.partial}>! {run.counts.error.toLocaleString()} errors</span>}
          </div>
          <div className={styles.progressTrack} aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </article>
    </Link>
  );
}

function PendingReadiness({ runs }: { runs: LiveRunListItem[] }) {
  const activeRun = runs.find((run) => run.status === "running" || run.status === "queued");
  return (
    <div className={styles.pendingReadiness}>
      <div className={styles.pendingTop}>
        <Eyebrow>Agent readiness</Eyebrow>
        <span className={styles.pendingSignal} aria-hidden />
      </div>
      <div className={styles.pendingScore}>
        <span>—</span>
        <small>%</small>
      </div>
      <h3>{activeRun ? "Evidence is still resolving." : "No completed evidence yet."}</h3>
      <p>
        {activeRun
          ? `Run ${activeRun.id} is in flight. Readiness will settle when its scenarios complete.`
          : "Complete a run to calculate readiness, strengths, and weaknesses."}
      </p>
      <ButtonLink href={activeRun ? `/runs?run=${activeRun.id}` : "/runs"} variant="secondary" size="sm">
        {activeRun ? "Watch the run" : "Start a run"}
      </ButtonLink>
    </div>
  );
}

function DashboardLoading() {
  return (
    <section className={styles.loadingStage} aria-live="polite" aria-label="Loading dashboard evidence">
      <div className={styles.metricsLoading}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={styles.loadingMetric}>
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-5 h-10 w-16" />
            <Skeleton className="mt-4 h-2 w-32" />
          </div>
        ))}
      </div>
      <div className={styles.dashboardLoadingGrid}>
        <div className={styles.loadingList}>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
        <Skeleton className="h-[32rem] w-full" />
      </div>
      <span className="sr-only">Loading dashboard evidence…</span>
    </section>
  );
}

function EmptyDashboard({ runs }: { runs: LiveRunListItem[] }) {
  return (
    <>
      <div className={styles.activationStage}>
        <ActivationChecklist runs={runs} />
      </div>
      <section className={styles.emptyStage}>
        <div className={styles.emptyGrid} aria-hidden />
        <div className={styles.emptyCopy}>
          <Eyebrow>Workspace ready</Eyebrow>
          <h2>Put your first agent through Preflight.</h2>
          <p>
            Run against the simulated store, inspect every decision, and turn the result into
            evidence you can act on.
          </p>
          <div className={styles.emptyActions}>
            <ButtonLink href="/runs">Start a run</ButtonLink>
            <ButtonLink variant="secondary" href="/agents/connect">
              Connect an agent
            </ButtonLink>
          </div>
        </div>

        <div className={styles.emptyPipeline} aria-label="Preflight evaluation flow">
          {[
            ["01", "Agent", "HTTP or provider"],
            ["02", "Scenario suite", "Real tool paths"],
            ["03", "Evidence", "Replay and verdict"],
          ].map(([number, title, detail], index) => (
            <div key={title} className={styles.pipelineStep}>
              <span>{number}</span>
              <strong>{title}</strong>
              <small>{detail}</small>
              {index < 2 && <i aria-hidden />}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
