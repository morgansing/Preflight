"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink, EmptyState, Eyebrow, LoadError, Skeleton } from "./ui";
import { MockBadge } from "./live-mission-control";
import { fetchRuns } from "@/lib/live-api";
import type { LiveRunListItem } from "@/lib/live-types";
import { suiteLabel } from "@/lib/suite-tiers";
import styles from "./evidence-ledger.module.css";

/** "3m ago" / "2h ago" / "5d ago" from an ISO timestamp. */
export function agoLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Live run history — the ledger of real runs, from the database. Each
 * row opens the run: finished runs get their detail page, a running one
 * attaches to the live wall.
 */
export function LiveRunHistory() {
  // undefined = loading · null = fetch failed.
  const [runs, setRuns] = useState<LiveRunListItem[] | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    fetchRuns().then(setRuns);
  }, [attempt]);

  if (runs === undefined) {
    return (
      <div className={styles.page} aria-label="Loading run history">
        <div className={styles.loadingPanel}>
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-14 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <div className={styles.statePanel}>
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (runs === null) {
    return (
      <div className={styles.page}>
        <div className={styles.statePanel}>
          <LoadError what="the run history" onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.statePanel}>
          <EmptyState
            icon={
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-8">
                <circle cx="16" cy="16" r="12.5" />
                <path d="M13.5 11.5l7 4.5-7 4.5z" fill="currentColor" stroke="none" />
              </svg>
            }
            title="No live runs yet."
            body="Run history fills in as you run agents against the store — sandbox runs count too, and they're free."
            action={<ButtonLink href="/runs">Start a run</ButtonLink>}
          />
        </div>
      </div>
    );
  }

  const completed = runs.filter((run) => run.status === "complete").length;
  const inFlight = runs.filter((run) => run.status === "running").length;
  const withMisses = runs.filter(
    (run) => run.counts.fail + run.counts.partial + run.counts.error > 0,
  ).length;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <Eyebrow>Evidence ledger / live runs</Eyebrow>
          <h1 className={styles.pageTitle}>Run history</h1>
          <div className={styles.pageMeta}>
            <span>The last {runs.length} live runs</span>
            <span className={styles.metaDivider} aria-hidden />
            <span>Newest evidence first</span>
            <span className={styles.metaDivider} aria-hidden />
            <span>Every row opens the underlying run</span>
          </div>
        </div>
        <div className={`no-print ${styles.pageActions}`}>
          <ButtonLink href="/runs" variant="secondary">
            New run →
          </ButtonLink>
        </div>
      </header>

      <div className={styles.summaryGrid} aria-label="Live run history summary">
        <SummaryMetric label="Completed" value={completed} hint={`${runs.length} recorded total`} />
        <SummaryMetric
          label="In flight"
          value={inFlight}
          hint={inFlight === 1 ? "run executing now" : "runs executing now"}
          tone={inFlight > 0 ? "accent" : undefined}
        />
        <SummaryMetric
          label="Runs with misses"
          value={withMisses}
          hint={`${runs.length - withMisses} fully clear`}
          tone={withMisses > 0 ? "fail" : "accent"}
        />
      </div>

      <div className={styles.ledger}>
        <div className={`${styles.ledgerHeader} ${styles.liveGrid}`}>
          <span>Agent · run</span>
          <span>Suite</span>
          <span className={styles.ledgerMetric}>Score</span>
          <span className={styles.ledgerMetric}>Passed</span>
          <span className={styles.ledgerMetric}>Misses</span>
          <span className={styles.ledgerMetric}>When</span>
        </div>
        <div className={styles.ledgerRows}>
          {runs.map((r) => {
            const running = r.status === "running";
            const href = running ? `/runs?run=${r.id}` : `/runs/${r.id}`;
            return (
              <Link
                key={r.id}
                href={href}
                className={`focus-ring ${styles.ledgerRow} ${styles.liveGrid}`}
              >
                <span className={styles.ledgerPrimary}>
                  <span className="flex items-center gap-2">
                    {running && (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent animate-pulse-cell" />
                    )}
                    <span className={styles.ledgerAgent}>{r.agentName}</span>
                    {r.provider === "mock" && <MockBadge />}
                  </span>
                  <span className={styles.ledgerRef}>
                    {r.id}
                    {running && " · running"}
                    {r.status === "error" && <span className="text-warn"> · run error</span>}
                  </span>
                </span>
                <span className={styles.ledgerSecondary} data-label="Suite">
                  {suiteLabel(r.suite, r.total)}
                </span>
                <span className={styles.ledgerMetric} data-label="Score">
                  <span className={styles.ledgerScore}>{r.score}</span>
                  <span className="text-[12px] text-mut">%</span>
                </span>
                <span className={styles.ledgerMetric} data-label="Passed">
                  {r.counts.pass}/{r.total}
                </span>
                <span className={styles.ledgerMetric} data-label="Misses">
                  <span className={r.counts.fail > 0 ? "text-fail" : "text-mut"}>
                    ✗ {r.counts.fail}
                  </span>
                  {r.counts.partial > 0 && <span className="text-warn"> ◐ {r.counts.partial}</span>}
                  {r.counts.error > 0 && <span className="text-warn"> ! {r.counts.error}</span>}
                </span>
                <span className={`${styles.ledgerMetric} text-mut`} data-label="When">
                  {agoLabel(r.startedAt)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <p className={styles.ledgerFootnote}>
        Every scenario in a live run keeps its full transcript — open a run and click any
        cell to replay it.
      </p>
    </div>
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
