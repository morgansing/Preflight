"use client";

import Link from "next/link";
import { use } from "react";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { LiveEmpty } from "@/components/live-empty";
import { demoAgents } from "@/lib/fixtures/agents";
import { demoReport } from "@/lib/fixtures/report";
import { demoRun } from "@/lib/fixtures/run";
import { categoryResults, getPastRun, runOutcomes } from "@/lib/fixtures/runs";
import { scenarios } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";
import { verdictFor, type Outcome } from "@/lib/types";

/**
 * Run detail — one entry from the run history, opened. The final wall,
 * per-category results, and (for the workspace's latest run) a click
 * through to every scenario's replay.
 */
export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useMode();

  if (mode === "live") return <LiveEmpty surface="each run's detail page" />;

  const run = getPastRun(id);
  const outcomes = runOutcomes(id);

  if (!run || !outcomes) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24 text-center">
        <Eyebrow>Run</Eyebrow>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">Run not found</h1>
        <p className="mt-3 text-sm text-sub">This run isn&apos;t in the demo workspace.</p>
        <div className="mt-8">
          <ButtonLink href="/runs/history" variant="secondary">
            ← Back to run history
          </ButtonLink>
        </div>
      </div>
    );
  }

  const agent = demoAgents.find((a) => a.id === run.agentId);
  const threshold = agent?.threshold ?? 90;
  const above = run.score >= threshold;
  const isLatest = run.id === demoRun.id;
  const categories = [...categoryResults(run.id)].sort(
    (a, b) => a.pass / a.total - b.pass / b.total,
  );

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <Link
        href="/runs/history"
        className="focus-ring rounded font-mono text-[11px] tracking-wider text-mut hover:text-sub"
      >
        ← RUN HISTORY
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: above ? "var(--color-accent)" : "var(--color-fail)" }}
            />
            <h1 className="font-display text-3xl tracking-tight text-ink">
              {run.agentName} <span className="text-sub">{run.agentVersion}</span>
            </h1>
          </div>
          <p className="mt-2 font-mono text-[12px] text-mut">
            {run.id} · {run.suite} · {run.label} · {fmtClock(run.durationMs)} ·{" "}
            ${run.costUsd.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <div className="numeral text-5xl text-ink">
            {run.score}
            <span className="text-2xl text-mut">%</span>
          </div>
          <div className={`text-sm font-medium ${above ? "text-accent" : "text-sub"}`}>
            {verdictFor(run.score)}
            {run.delta !== undefined && run.delta !== 0 && (
              <span
                className={`ml-2 font-mono text-[11px] tabular-nums ${
                  run.delta > 0 ? "text-accent" : "text-fail"
                }`}
              >
                {run.delta > 0 ? `+${run.delta}` : run.delta}
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-[11px] text-mut">
            deployment threshold {threshold}%
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="mt-6 flex flex-wrap gap-3">
        {agent && (
          <ButtonLink href={`/agents/${agent.id}`} variant="secondary" size="sm">
            Open agent page →
          </ButtonLink>
        )}
        {isLatest && run.id === demoReport.runId && (
          <ButtonLink href="/reports" size="sm">
            Open readiness report →
          </ButtonLink>
        )}
        {isLatest && (
          <ButtonLink href="/runs" variant="secondary" size="sm">
            Watch it fill in live →
          </ButtonLink>
        )}
      </div>

      {/* Result strip */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Passed" value={`${run.passed}/${run.total}`} tone="accent" />
        <StatCard label="Failed" value={String(run.failed)} tone={run.failed > 0 ? "fail" : undefined} />
        <StatCard label="Critical fails" value={String(run.critical)} tone={run.critical > 0 ? "fail" : undefined} />
        <StatCard label="Partial" value={String(run.partial)} />
        <StatCard label="Duration" value={fmtClock(run.durationMs)} />
      </div>

      {/* The wall, settled */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">The wall</h2>
          <span className="flex items-center gap-5 font-mono text-[11px] tabular-nums text-sub">
            <span>
              <span aria-hidden className="text-accent">✓</span> {run.passed}
            </span>
            <span>
              <span aria-hidden className="text-fail">✗</span> {run.failed}
            </span>
            <span>
              <span aria-hidden className="text-warn">◐</span> {run.partial}
            </span>
          </span>
        </div>
        <Card className="mt-4">
          <StaticWall outcomes={outcomes} interactive={isLatest} />
        </Card>
        <p className="mt-3 text-[12px] text-mut">
          {isLatest ? (
            <>Every cell links to the full transcript replay of that scenario.</>
          ) : (
            <>
              Replays are retained for the workspace&apos;s most recent run —{" "}
              <Link
                href={`/runs/${demoRun.id}`}
                className="focus-ring rounded text-accent hover:underline"
              >
                open {demoRun.id} →
              </Link>
            </>
          )}
        </p>
      </section>

      {/* Category results */}
      <section className="mt-12">
        <h2 className="font-display text-xl text-ink">Category results</h2>
        <Card className="mt-4 divide-y divide-edge p-0">
          {categories.map((c) => {
            const pct = Math.round((c.pass / c.total) * 100);
            const tint = pct === 100 ? "bg-accent" : pct >= 70 ? "bg-warn" : "bg-fail";
            return (
              <div key={c.category} className="flex items-center gap-4 px-5 py-3">
                <span className="w-44 shrink-0 text-[13px] text-ink">{c.category}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                  <div className={`h-full rounded-full ${tint}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-sub">
                  {c.pass}/{c.total}
                </span>
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}

/* The demo wall's visual language, settled: no timings, no animation —
 * this run already happened. */
const wallCellStyles: Record<Outcome, string> = {
  pass: "bg-accent/12 text-accent",
  fail: "bg-fail/18 text-fail",
  partial: "bg-warn/15 text-warn",
};
const wallCellGlyph: Record<Outcome, string> = { pass: "✓", fail: "✗", partial: "◐" };

function StaticWall({
  outcomes,
  interactive,
}: {
  outcomes: Map<string, Outcome>;
  interactive: boolean;
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
      role="grid"
      aria-label="Scenario outcomes"
    >
      {scenarios.map((s) => {
        const outcome = outcomes.get(s.id) ?? "pass";
        const title = `${s.id} · ${s.name} · ${outcome}`;
        const cell = (
          <span
            className={`flex aspect-square w-full items-center justify-center rounded-[4px] text-[10px] leading-none ${
              wallCellStyles[outcome]
            } ${interactive ? "hover:ring-1 hover:ring-mut" : ""}`}
          >
            {wallCellGlyph[outcome]}
          </span>
        );
        if (!interactive) {
          return (
            <div key={s.id} title={title}>
              {cell}
            </div>
          );
        }
        return (
          <Link
            key={s.id}
            href={`/replay/${s.id}`}
            title={title}
            className="focus-ring block w-full rounded-[4px]"
          >
            {cell}
          </Link>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "fail";
}) {
  return (
    <Card className="p-4">
      <div className="eyebrow">{label}</div>
      <div
        className={`numeral mt-1 text-3xl ${
          tone === "accent" ? "text-accent" : tone === "fail" ? "text-fail" : "text-ink"
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
