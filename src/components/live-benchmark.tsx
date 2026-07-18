"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ButtonLink, Card, EmptyState, Eyebrow, LoadError, SeverityLabel, Skeleton } from "./ui";
import { MockBadge } from "./live-mission-control";
import { fetchRun, fetchRuns } from "@/lib/live-api";
import { scoreOf, type LiveRunSummary } from "@/lib/live-types";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import type { Severity } from "@/lib/types";

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
    return { a, b, newlyBroken, newlyPassing };
  }, [pair]);

  if (pair === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-8 py-10">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (pair === "failed") {
    return (
      <div className="mx-auto max-w-5xl px-8 py-24">
        <LoadError what="the benchmark" onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }
  if (!diff) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24">
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
    );
  }

  const { a, b, newlyBroken, newlyPassing } = diff;
  const scoreA = scoreOf(a.results);
  const scoreB = scoreOf(b.results);
  const delta = scoreB - scoreA;

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-3xl tracking-tight text-ink">Benchmark</h1>
        {(a.provider === "mock" || b.provider === "mock") && <MockBadge />}
      </div>
      <p className="mt-2 text-sm text-sub">
        {a.agentName} ({a.id}) vs {b.agentName} ({b.id}) · two most recent completed runs
      </p>

      <Card className="mt-10 flex flex-wrap items-center justify-between gap-8 p-8">
        <RunColumn label={`${a.agentName} · ${a.id}`} score={scoreA} date={a.startedAt} />
        <div className="text-center">
          <div className={`numeral text-6xl ${delta >= 0 ? "text-accent" : "text-fail"}`}>
            {delta >= 0 ? "+" : ""}
            {delta}
          </div>
          <Eyebrow className="mt-2">points</Eyebrow>
        </div>
        <RunColumn label={`${b.agentName} · ${b.id}`} score={scoreB} date={b.startedAt} align="right" />
      </Card>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
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
  score,
  date,
  align = "left",
}: {
  label: string;
  score: number;
  date: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <Eyebrow>{label}</Eyebrow>
      <div className="numeral mt-2 text-5xl text-ink">
        {score}
        <span className="text-2xl text-mut">%</span>
      </div>
      <div className="mt-1 text-[12px] text-mut">
        {new Date(date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
      </div>
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
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium text-ink">
          <span aria-hidden className={`mr-2 font-mono ${tone === "fail" ? "text-fail" : "text-accent"}`}>
            {glyph}
          </span>
          {title}
        </h2>
        <span className={`font-mono text-[12px] tabular-nums ${tone === "fail" ? "text-fail" : "text-accent"}`}>
          {items.length}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] text-sub">{note}</p>
      <div className="mt-4 space-y-2">
        {items.length === 0 && <p className="text-[13px] text-mut">None.</p>}
        {items.slice(0, 30).map((item) => {
          const s = getScenarioById(item.id);
          const name = item.name ?? s?.name ?? item.id;
          const category = item.category ?? s?.category ?? "";
          return (
            <Link
              key={item.id}
              href={`/replay/${item.id}?run=${runId}`}
              className="focus-ring flex items-center justify-between gap-4 rounded-lg border border-edge bg-surface px-4 py-3 transition-all duration-200 hover:-translate-y-px hover:border-mut"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: `var(--color-${tone})` }}
                  />
                  <span className="truncate text-[13px] text-ink">{name}</span>
                </div>
                <div className="mt-1 pl-4 font-mono text-[11px] text-mut">
                  {item.id} · {category}
                </div>
              </div>
              <SeverityLabel severity={item.severity} />
            </Link>
          );
        })}
        {items.length > 30 && (
          <p className="pt-1 text-[12px] text-mut">+{items.length - 30} more</p>
        )}
      </div>
    </section>
  );
}
