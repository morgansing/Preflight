"use client";

import Link from "next/link";
import { ButtonLink, Card, Eyebrow, SeverityLabel } from "@/components/ui";
import { LiveBenchmark } from "@/components/live-benchmark";
import {
  categoryComparison,
  demoBenchmark,
  type BenchmarkEntry,
  type CategoryComparison,
} from "@/lib/fixtures/benchmark";
import { useMode } from "@/lib/mode";
import type { Severity } from "@/lib/types";
import styles from "@/components/evidence-ledger.module.css";

/**
 * Benchmark — two runs on the same suite, diffed. The "newly broken"
 * list is the reason testing becomes a subscription.
 */
export default function BenchmarkPage() {
  const { mode } = useMode();
  if (mode === "live") return <LiveBenchmark />;

  const b = demoBenchmark;
  const delta = b.b.score - b.a.score;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <Eyebrow>Evidence ledger / comparison</Eyebrow>
          <h1 className={styles.pageTitle}>Benchmark</h1>
          <div className={styles.pageMeta}>
            <span>{b.a.label}</span>
            <span className={styles.metaDivider} aria-hidden />
            <span>{b.b.label}</span>
            <span className={styles.metaDivider} aria-hidden />
            <span>{b.suite}</span>
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

      {/* Score delta */}
      <div className={styles.comparisonCard}>
        <RunColumn label={b.a.label} score={b.a.score} date={b.a.date} runId={b.a.runId} />
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
          label={b.b.label}
          score={b.b.score}
          date={b.b.date}
          runId={b.b.runId}
          align="right"
        />
      </div>
      <p className={styles.comparisonNote}>
        Same agent, same 200-scenario suite. Score movement is backed by the scenario changes below.
      </p>

      <div className={styles.diffGrid}>
        {/* Newly broken — the list that matters */}
        <section className={styles.diffPanel} data-tone="fail">
          <div className={styles.diffHeader}>
            <h2 className={styles.diffTitle}>
              <span aria-hidden className={styles.diffGlyph}>✗</span>
              Newly broken
            </h2>
            <span className={styles.diffCount} aria-label={`${b.newlyBroken.length} newly broken scenarios`}>
              {b.newlyBroken.length}
            </span>
          </div>
          <p className={styles.diffNote}>
            Passed in {b.a.label.split(" ").pop()}, fails in{" "}
            {b.b.label.split(" ").pop()}. These are regressions your customers
            would have found for you.
          </p>
          <div className={styles.entryList}>
            {b.newlyBroken.map((e) => (
              <EntryRow key={e.scenarioId} entry={e} tone="fail" />
            ))}
          </div>
        </section>

        {/* Newly passing */}
        <section className={styles.diffPanel} data-tone="accent">
          <div className={styles.diffHeader}>
            <h2 className={styles.diffTitle}>
              <span aria-hidden className={styles.diffGlyph}>✓</span>
              Newly passing
            </h2>
            <span className={styles.diffCount} aria-label={`${b.newlyPassing.length} newly passing scenarios`}>
              {b.newlyPassing.length}
            </span>
          </div>
          <p className={styles.diffNote}>
            Fixed since {b.a.label.split(" ").pop()} — the work paying off.
          </p>
          <div className={styles.entryList}>
            {b.newlyPassing.map((e) => (
              <EntryRow key={e.scenarioId} entry={e} tone="accent" />
            ))}
          </div>
        </section>
      </div>

      {/* Per-category deep-dive: where the points moved, and which net
          gains hide a regression inside them. */}
      <section className={styles.section} aria-labelledby="category-deep-dive-heading">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <span className={styles.sectionIndex}>EVIDENCE / CAPABILITY</span>
            <h2 id="category-deep-dive-heading" className={styles.sectionTitle}>Category deep-dive</h2>
          </div>
          <span className={styles.sectionNote}>
            Upper bar {b.a.label.split(" ").pop()} · lower bar {b.b.label.split(" ").pop()}
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-sub">
          The {delta >= 0 ? `+${delta}` : delta}-point move, unpacked. A category can gain
          overall and still break scenarios it used to pass — those regressions are flagged.
        </p>
        <Card className={styles.categoryPanel}>
          {[...categoryComparison]
            .sort((x, y) => (y.bPass - y.aPass) - (x.bPass - x.aPass))
            .map((c) => (
              <CategoryRow key={c.category} c={c} />
            ))}
        </Card>
      </section>

      <section className={styles.section} aria-labelledby="unchanged-failures-heading">
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <span className={styles.sectionIndex}>EVIDENCE / OPEN DEBT</span>
            <h2 id="unchanged-failures-heading" className={styles.sectionTitle}>Still failing in both</h2>
          </div>
          <span className={styles.sectionNote}>{b.unchangedFails.length} persistent failures</span>
        </div>
        <div className={styles.unchangedPanel}>
          <Eyebrow>Open replay evidence</Eyebrow>
          <div className={styles.scenarioLinks}>
          {b.unchangedFails.map((e) => (
            <Link
              key={e.scenarioId}
              href={`/replay/${e.scenarioId}`}
              className={`focus-ring ${styles.scenarioLink}`}
            >
              {e.scenarioId}
            </Link>
          ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function RunColumn({
  label,
  score,
  date,
  runId,
  align = "left",
}: {
  label: string;
  score: number;
  date: string;
  runId?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`${styles.runColumn} ${align === "right" ? styles.runColumnRight : ""}`}>
      <Eyebrow>{label}</Eyebrow>
      <div className={styles.runScore}>
        {score}
        <span className="text-2xl text-mut">%</span>
      </div>
      <div className={styles.runDate}>{date}</div>
      {runId && (
        <Link
          href={`/runs/${runId}`}
          className={`focus-ring ${styles.runLink}`}
        >
          Open {runId} →
        </Link>
      )}
    </div>
  );
}

function CategoryRow({ c }: { c: CategoryComparison }) {
  const deltaPass = c.bPass - c.aPass;
  const bPct = Math.round((c.bPass / c.total) * 100);
  const tint = bPct === 100 ? "bg-accent" : bPct >= 70 ? "bg-warn" : "bg-fail";
  return (
    <div className={styles.categoryRow}>
      <span className={styles.categoryName}>{c.category}</span>
      <div className={styles.categoryBars} aria-hidden>
        <div className="h-1 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-mut/50"
            style={{ width: `${Math.round((c.aPass / c.total) * 100)}%` }}
          />
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-raised">
          <div className={`h-full rounded-full ${tint}`} style={{ width: `${bPct}%` }} />
        </div>
      </div>
      <span className={styles.categoryValue} data-label="Pass movement">
        {c.aPass} → {c.bPass}
        <span className="text-mut">/{c.total}</span>
      </span>
      <span
        data-label="Delta"
        className={`${styles.categoryDelta} ${
          deltaPass > 0 ? "text-accent" : deltaPass < 0 ? "text-fail" : "text-mut"
        }`}
      >
        {deltaPass > 0 ? `+${deltaPass}` : deltaPass === 0 ? "—" : deltaPass}
      </span>
      <span className={styles.categoryRegression} data-label="Regressions">
        {c.regressions > 0 ? `${c.regressions} newly broken` : "—"}
      </span>
    </div>
  );
}

function EntryRow({ entry, tone }: { entry: BenchmarkEntry; tone: "fail" | "accent" }) {
  return (
    <Link
      href={`/replay/${entry.scenarioId}`}
      className={`focus-ring ${styles.entryRow}`}
    >
      <div className={styles.entryMain}>
        <div className={styles.entryTitle}>
          <span
            aria-hidden
            className={styles.entryDot}
            style={{ background: `var(--color-${tone})` }}
          />
          <span>{entry.name}</span>
        </div>
        <div className={styles.entryMeta}>
          {entry.scenarioId} · {entry.category}
        </div>
      </div>
      <SeverityLabel severity={entry.severity as Severity} />
    </Link>
  );
}
