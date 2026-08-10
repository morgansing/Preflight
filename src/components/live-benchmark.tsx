"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ButtonLink, EmptyState, Eyebrow, LoadError, SeverityLabel, Skeleton } from "./ui";
import { MockBadge } from "./live-mission-control";
import { fetchRun, fetchRuns } from "@/lib/live-api";
import { scoreOf, type LiveRunSummary } from "@/lib/live-types";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import type { Severity } from "@/lib/types";
import styles from "./evidence-ledger.module.css";

/** Live benchmark: diff the two most recent completed runs. */
export function LiveBenchmark() {
  // undefined = loading · "failed" = fetch failed · null = <2 completed runs.
  const [pair, setPair] = useState<
    { a: LiveRunSummary; b: LiveRunSummary } | null | undefined | "failed"
  >(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    (async (): Promise<{ a: LiveRunSummary; b: LiveRunSummary } | null | "failed"> => {
      const list = await fetchRuns();
      if (!list) return "failed";
      const complete = list.filter((r) => r.status === "complete");
      if (complete.length < 2) return null;
      const [b, a] = await Promise.all([fetchRun(complete[0].id), fetchRun(complete[1].id)]);
      return a && b ? { a, b } : null;
    })().then(setPair);
  }, [attempt]);

  const diff = useMemo(() => {
    if (!pair || pair === "failed") return null;
    const { a, b } = pair; // b = newest
    const aByScenario = new Map(a.results.map((r) => [r.scenarioId, r.outcome]));
    const shared = b.results.filter((r) => aByScenario.has(r.scenarioId));
    const newlyBroken = shared.filter(
      (r) => r.outcome === "fail" && aByScenario.get(r.scenarioId) === "pass",
    );
    const newlyPassing = shared.filter(
      (r) => r.outcome === "pass" && ["fail", "partial"].includes(aByScenario.get(r.scenarioId)!),
    );
    return { a, b, newlyBroken, newlyPassing, sharedCount: shared.length };
  }, [pair]);

  if (pair === undefined) {
    return (
      <div className={styles.page} aria-label="Loading benchmark">
        <div className={styles.loadingPanel}>
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-14 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <div className={styles.statePanel}>
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (pair === "failed") {
    return (
      <div className={styles.page}>
        <div className={styles.statePanel}>
          <LoadError what="the benchmark" onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      </div>
    );
  }
  if (!diff) {
    return (
      <div className={styles.page}>
        <div className={styles.statePanel}>
          <EmptyState
            icon={
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-8">
                <path d="M6 27V16M16 27V7M26 27v-8" strokeLinecap="round" />
              </svg>
            }
            title="Benchmarking needs two completed runs."
            body="Run the same suite twice — after a prompt change, a model swap, a fix — and Preflight shows exactly what improved and what broke."
            action={<ButtonLink href="/runs">Start a run</ButtonLink>}
          />
        </div>
      </div>
    );
  }

  const { a, b, newlyBroken, newlyPassing, sharedCount } = diff;
  const scoreA = scoreOf(a.results);
  const scoreB = scoreOf(b.results);
  const delta = scoreB - scoreA;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className="flex items-center gap-3">
            <Eyebrow>Evidence ledger / automatic comparison</Eyebrow>
            {(a.provider === "mock" || b.provider === "mock") && <MockBadge />}
          </div>
          <h1 className={styles.pageTitle}>Benchmark</h1>
          <div className={styles.pageMeta}>
            <span>{a.agentName} · {a.id}</span>
            <span className={styles.metaDivider} aria-hidden />
            <span>{b.agentName} · {b.id}</span>
            <span className={styles.metaDivider} aria-hidden />
            <span>Two most recent completed runs</span>
          </div>
        </div>
        <div className={`no-print ${styles.pageActions}`}>
          <ButtonLink href="/runs/history" variant="ghost" size="sm">
            Run history
          </ButtonLink>
          <ButtonLink href="/runs" variant="secondary" size="sm">
            New run →
          </ButtonLink>
        </div>
      </header>

      <div className={styles.comparisonCard}>
        <RunColumn
          label="Previous completed"
          agentName={a.agentName}
          runId={a.id}
          score={scoreA}
          date={a.startedAt}
        />
        <div className={styles.deltaColumn}>
          <div
            className={styles.deltaValue}
            data-tone={delta < 0 ? "fail" : "accent"}
            aria-label={`Score movement ${delta >= 0 ? "plus " : "minus "}${Math.abs(delta)} points`}
          >
            {delta >= 0 ? "+" : ""}
            {delta}
          </div>
          <span className={styles.deltaRule}>points</span>
        </div>
        <RunColumn
          label="Latest completed"
          agentName={b.agentName}
          runId={b.id}
          score={scoreB}
          date={b.startedAt}
          align="right"
        />
      </div>
      <p className={styles.comparisonNote}>
        {sharedCount.toLocaleString()} shared scenarios compared. Only matching scenario IDs can change state here.
      </p>

      <div className={styles.diffGrid}>
        <DiffList
          tone="fail"
          glyph="✗"
          title="Newly broken"
          note="Passed in the previous run, fails now."
          items={newlyBroken.map((r) => ({ id: r.scenarioId, severity: r.severity, name: r.name, category: r.category }))}
          runId={b.id}
        />
        <DiffList
          tone="accent"
          glyph="✓"
          title="Newly passing"
          note="Fixed since the previous run."
          items={newlyPassing.map((r) => ({ id: r.scenarioId, severity: r.severity, name: r.name, category: r.category }))}
          runId={b.id}
        />
      </div>
    </div>
  );
}

function RunColumn({
  label,
  agentName,
  runId,
  score,
  date,
  align = "left",
}: {
  label: string;
  agentName: string;
  runId: string;
  score: number;
  date: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`${styles.runColumn} ${align === "right" ? styles.runColumnRight : ""}`}>
      <Eyebrow>{label}</Eyebrow>
      <div className={styles.liveRunName}>{agentName}</div>
      <div className={styles.runScore}>
        {score}
        <span className="text-2xl text-mut">%</span>
      </div>
      <div className={styles.runDate}>
        {new Date(date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
      </div>
      <Link href={`/runs/${runId}`} className={`focus-ring ${styles.runLink}`}>
        Open {runId} →
      </Link>
    </div>
  );
}

function DiffList({
  tone,
  glyph,
  title,
  note,
  items,
  runId,
}: {
  tone: "fail" | "accent";
  glyph: string;
  title: string;
  note: string;
  items: Array<{ id: string; severity: Severity; name?: string; category?: string }>;
  runId: string;
}) {
  const preview = items.slice(0, 12);
  const remaining = items.slice(12);

  const rows = (list: typeof items) => list.map((item) => {
    const scenario = getScenarioById(item.id);
    const name = item.name ?? scenario?.name ?? item.id;
    const category = item.category ?? scenario?.category ?? "";
    return (
      <Link
        key={item.id}
        href={`/replay/${item.id}?run=${runId}`}
        className={`focus-ring ${styles.entryRow}`}
      >
        <div className={styles.entryMain}>
          <div className={styles.entryTitle}>
            <span
              aria-hidden
              className={styles.entryDot}
              style={{ background: `var(--color-${tone})` }}
            />
            <span>{name}</span>
          </div>
          <div className={styles.entryMeta}>
            {item.id} · {category}
          </div>
        </div>
        <SeverityLabel severity={item.severity} />
      </Link>
    );
  });

  return (
    <section className={styles.diffPanel} data-tone={tone}>
      <div className={styles.diffHeader}>
        <h2 className={styles.diffTitle}>
          <span aria-hidden className={styles.diffGlyph}>
            {glyph}
          </span>
          {title}
        </h2>
        <span className={styles.diffCount} aria-label={`${items.length} ${title.toLowerCase()} scenarios`}>
          {items.length}
        </span>
      </div>
      <p className={styles.diffNote}>{note}</p>
      <div className={styles.entryList}>
        {items.length === 0 && <p className={styles.diffEmpty}>None in this comparison.</p>}
        {rows(preview)}
      </div>
      {remaining.length > 0 && (
        <details className={styles.moreDetails}>
          <summary>Show {remaining.length} remaining scenarios</summary>
          <div className={styles.entryList}>{rows(remaining)}</div>
        </details>
      )}
    </section>
  );
}
