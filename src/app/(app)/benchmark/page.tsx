"use client";

import Link from "next/link";
import { Card, Eyebrow, SeverityLabel } from "@/components/ui";
import { LiveBenchmark } from "@/components/live-benchmark";
import {
  categoryComparison,
  demoBenchmark,
  type BenchmarkEntry,
  type CategoryComparison,
} from "@/lib/fixtures/benchmark";
import { useMode } from "@/lib/mode";
import type { Severity } from "@/lib/types";

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
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="font-display text-3xl tracking-tight text-ink">Benchmark</h1>
      <p className="mt-2 text-sm text-sub">
        {b.a.label} vs {b.b.label} · {b.suite}
      </p>

      {/* Score delta */}
      <Card className="mt-10 flex flex-wrap items-center justify-between gap-8 p-8">
        <RunColumn label={b.a.label} score={b.a.score} date={b.a.date} runId={b.a.runId} />
        <div className="text-center">
          <div className="numeral text-6xl text-accent">
            {delta >= 0 ? "+" : ""}
            {delta}
          </div>
          <Eyebrow className="mt-2">points</Eyebrow>
        </div>
        <RunColumn
          label={b.b.label}
          score={b.b.score}
          date={b.b.date}
          runId={b.b.runId}
          align="right"
        />
      </Card>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Newly broken — the list that matters */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium text-ink">
              <span aria-hidden className="mr-2 font-mono text-fail">✗</span>
              Newly broken
            </h2>
            <span className="font-mono text-[12px] tabular-nums text-fail">
              {b.newlyBroken.length}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-sub">
            Passed in {b.a.label.split(" ").pop()}, fails in{" "}
            {b.b.label.split(" ").pop()}. These are regressions your customers
            would have found for you.
          </p>
          <div className="mt-4 space-y-2">
            {b.newlyBroken.map((e) => (
              <EntryRow key={e.scenarioId} entry={e} tone="fail" />
            ))}
          </div>
        </section>

        {/* Newly passing */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium text-ink">
              <span aria-hidden className="mr-2 font-mono text-accent">✓</span>
              Newly passing
            </h2>
            <span className="font-mono text-[12px] tabular-nums text-accent">
              {b.newlyPassing.length}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-sub">
            Fixed since {b.a.label.split(" ").pop()} — the work paying off.
          </p>
          <div className="mt-4 space-y-2">
            {b.newlyPassing.map((e) => (
              <EntryRow key={e.scenarioId} entry={e} tone="accent" />
            ))}
          </div>
        </section>
      </div>

      {/* Per-category deep-dive: where the points moved, and which net
          gains hide a regression inside them. */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium text-ink">Category deep-dive</h2>
          <span className="font-mono text-[11px] text-mut">
            upper bar {b.a.label.split(" ").pop()} · lower bar {b.b.label.split(" ").pop()}
          </span>
        </div>
        <p className="mt-1.5 text-[13px] text-sub">
          The {delta >= 0 ? `+${delta}` : delta}-point move, unpacked. A category can gain
          overall and still break scenarios it used to pass — those regressions are flagged.
        </p>
        <Card className="mt-4 divide-y divide-edge p-0">
          {[...categoryComparison]
            .sort((x, y) => (y.bPass - y.aPass) - (x.bPass - x.aPass))
            .map((c) => (
              <CategoryRow key={c.category} c={c} />
            ))}
        </Card>
      </section>

      <section className="mt-12 border-t border-edge pt-6">
        <Eyebrow>Still failing in both · {b.unchangedFails.length}</Eyebrow>
        <div className="mt-3 flex flex-wrap gap-2">
          {b.unchangedFails.map((e) => (
            <Link
              key={e.scenarioId}
              href={`/replay/${e.scenarioId}`}
              className="focus-ring rounded-md border border-edge px-2.5 py-1 font-mono text-[11px] text-sub transition-colors hover:border-mut hover:text-ink"
            >
              {e.scenarioId}
            </Link>
          ))}
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
    <div className={align === "right" ? "text-right" : ""}>
      <Eyebrow>{label}</Eyebrow>
      <div className="numeral mt-2 text-5xl text-ink">
        {score}
        <span className="text-2xl text-mut">%</span>
      </div>
      <div className="mt-1 text-[12px] text-mut">{date}</div>
      {runId && (
        <Link
          href={`/runs/${runId}`}
          className="focus-ring mt-1.5 inline-block rounded font-mono text-[11px] text-accent hover:underline"
        >
          {runId} →
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
    <div className="flex items-center gap-4 px-5 py-3">
      <span className="w-44 shrink-0 text-[13px] text-ink">{c.category}</span>
      <div className="flex flex-1 flex-col gap-[3px]" aria-hidden>
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
      <span className="w-28 shrink-0 text-right font-mono text-[12px] tabular-nums text-sub">
        {c.aPass} → {c.bPass}
        <span className="text-mut">/{c.total}</span>
      </span>
      <span
        className={`w-10 shrink-0 text-right font-mono text-[11px] tabular-nums ${
          deltaPass > 0 ? "text-accent" : deltaPass < 0 ? "text-fail" : "text-mut"
        }`}
      >
        {deltaPass > 0 ? `+${deltaPass}` : deltaPass === 0 ? "—" : deltaPass}
      </span>
      {c.regressions > 0 ? (
        <span className="w-28 shrink-0 text-right font-mono text-[11px] text-fail">
          {c.regressions} newly broken
        </span>
      ) : (
        <span aria-hidden className="w-28 shrink-0" />
      )}
    </div>
  );
}

function EntryRow({ entry, tone }: { entry: BenchmarkEntry; tone: "fail" | "accent" }) {
  return (
    <Link
      href={`/replay/${entry.scenarioId}`}
      className="focus-ring group flex items-center justify-between gap-4 rounded-lg border border-edge bg-surface px-4 py-3 transition-all duration-200 hover:-translate-y-px hover:border-mut"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: `var(--color-${tone})` }}
          />
          <span className="truncate text-[13px] text-ink">{entry.name}</span>
        </div>
        <div className="mt-1 pl-4 font-mono text-[11px] text-mut">
          {entry.scenarioId} · {entry.category}
        </div>
      </div>
      <SeverityLabel severity={entry.severity as Severity} />
    </Link>
  );
}
