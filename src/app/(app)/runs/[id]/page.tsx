"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { LiveRunDetail } from "@/components/live-run-detail";
import { demoAgents } from "@/lib/fixtures/agents";
import { demoReport } from "@/lib/fixtures/report";
import { demoRun } from "@/lib/fixtures/run";
import { categoryResults, getPastRun, runOutcomes } from "@/lib/fixtures/runs";
import { canLinkReplay, toPastRun, useSessionRuns } from "@/lib/demo-runs";
import { scenarioById, scenarios } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";
import { DIFFICULTY_LABELS, verdictFor, type Difficulty, type Outcome } from "@/lib/types";

/**
 * Run detail — one entry from the run history, opened. The final wall,
 * per-category results, and (for the workspace's latest run) a click
 * through to every scenario's replay.
 */
export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useMode();
  const sessionRuns = useSessionRuns();
  // Wall filter — the full run first, then one outcome at a time.
  const [filter, setFilter] = useState<"all" | Outcome>("all");

  if (mode === "live") return <LiveRunDetail runId={id} />;

  // Fixture run, or a fake test stored in this browser.
  const sessionRun = sessionRuns.find((r) => r.id === id);
  const run = getPastRun(id) ?? (sessionRun ? toPastRun(sessionRun) : undefined);
  const outcomes =
    runOutcomes(id) ??
    (sessionRun
      ? new Map(Object.entries(sessionRun.outcomes) as [string, Outcome][])
      : undefined);

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
  const fixtureCategories = categoryResults(run.id);
  const categories = (
    fixtureCategories.length > 0 ? fixtureCategories : categoriesFromOutcomes(outcomes)
  )
    .slice()
    .sort((a, b) => a.pass / a.total - b.pass / b.total);

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
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-ink">The wall</h2>
          <span className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
            {(
              [
                { id: "all" as const, label: `All ${run.total}` },
                { id: "pass" as const, label: `✓ ${run.passed}` },
                { id: "fail" as const, label: `✗ ${run.failed}` },
                { id: "partial" as const, label: `◐ ${run.partial}` },
              ]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`focus-ring h-7 cursor-pointer rounded-full border px-3 transition-colors ${
                  filter === f.id
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-edge text-sub hover:border-mut"
                }`}
              >
                {f.label}
              </button>
            ))}
          </span>
        </div>
        <Card className="mt-4">
          <StaticWall
            outcomes={outcomes}
            interactive={isLatest}
            scenarioIds={sessionRun?.scenarioIds}
            filter={filter}
            linkWhen={sessionRun ? canLinkReplay : undefined}
          />
        </Card>
        <p className="mt-3 text-[12px] text-mut">
          {isLatest ? (
            <>Every cell links to the full transcript replay of that scenario.</>
          ) : sessionRun ? (
            <>
              A fake test run in this browser — cells link to a replay where the demo
              transcript shows the same outcome.
            </>
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

      {/* By difficulty — does the score survive the hard scenarios? */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">By difficulty</h2>
          <span className="font-mono text-[11px] text-mut">
            severity is what a miss costs · difficulty is how likely it is
          </span>
        </div>
        <Card className="mt-4 divide-y divide-edge p-0">
          {difficultyResults(outcomes).map((d) => {
            const pct = Math.round((d.pass / d.total) * 100);
            const tint = pct === 100 ? "bg-accent" : pct >= 70 ? "bg-warn" : "bg-fail";
            return (
              <div key={d.level} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3">
                <span className="w-44 shrink-0 text-[13px] text-ink max-sm:w-full">
                  {d.level} · {DIFFICULTY_LABELS[d.level]}
                </span>
                <div className="h-1.5 min-w-36 flex-1 overflow-hidden rounded-full bg-raised">
                  <div className={`h-full rounded-full ${tint}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-sub">
                  {d.pass}/{d.total}
                </span>
              </div>
            );
          })}
        </Card>
      </section>

      {/* Category results */}
      <section className="mt-12">
        <h2 className="font-display text-xl text-ink">Category results</h2>
        <Card className="mt-4 divide-y divide-edge p-0">
          {categories.map((c) => {
            const pct = Math.round((c.pass / c.total) * 100);
            const tint = pct === 100 ? "bg-accent" : pct >= 70 ? "bg-warn" : "bg-fail";
            return (
              <div key={c.category} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3">
                <span className="w-44 shrink-0 text-[13px] text-ink max-sm:w-full">{c.category}</span>
                <div className="h-1.5 min-w-36 flex-1 overflow-hidden rounded-full bg-raised">
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

/** Pass/total per difficulty level, ascending — routine first, brutal last. */
function difficultyResults(
  outcomes: Map<string, Outcome>,
): { level: Difficulty; pass: number; total: number }[] {
  const byLevel = new Map<Difficulty, { pass: number; total: number }>();
  for (const s of scenarios) {
    const o = outcomes.get(s.id);
    if (!o) continue;
    const bucket = byLevel.get(s.difficulty) ?? { pass: 0, total: 0 };
    bucket.total += 1;
    if (o === "pass") bucket.pass += 1;
    byLevel.set(s.difficulty, bucket);
  }
  return [...byLevel.entries()]
    .map(([level, b]) => ({ level, ...b }))
    .sort((a, b) => a.level - b.level);
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
  scenarioIds,
  filter = "all",
  linkWhen,
}: {
  outcomes: Map<string, Outcome>;
  interactive: boolean;
  /** Restrict the wall to a suite subset (fake tests). */
  scenarioIds?: string[];
  /** Show only one outcome ("all" = the full wall). */
  filter?: "all" | Outcome;
  /** Per-cell link predicate — overrides `interactive` when given. */
  linkWhen?: (scenarioId: string, outcome: Outcome) => boolean;
}) {
  const full = scenarioIds
    ? scenarioIds.map((sid) => scenarioById.get(sid)).filter((s): s is (typeof scenarios)[number] => !!s)
    : scenarios;
  const list =
    filter === "all" ? full : full.filter((s) => (outcomes.get(s.id) ?? "pass") === filter);
  if (list.length === 0) {
    return <p className="py-8 text-center text-sm text-mut">Nothing with that outcome in this run.</p>;
  }
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
      role="grid"
      aria-label="Scenario outcomes"
    >
      {list.map((s) => {
        const outcome = outcomes.get(s.id) ?? "pass";
        const linked = linkWhen ? linkWhen(s.id, outcome) : interactive;
        const title = `${s.id} · ${s.name} · ${outcome}`;
        const cell = (
          <span
            className={`flex aspect-square w-full items-center justify-center rounded-[4px] text-[10px] leading-none ${
              wallCellStyles[outcome]
            } ${linked ? "hover:ring-1 hover:ring-mut" : ""}`}
          >
            {wallCellGlyph[outcome]}
          </span>
        );
        if (!linked) {
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

/** Category pass/total computed straight from an outcome map — used for
 * fake tests, whose outcomes cover only their suite's scenarios. */
function categoriesFromOutcomes(
  outcomes: Map<string, Outcome>,
): { category: string; pass: number; total: number }[] {
  const map = new Map<string, { pass: number; total: number }>();
  for (const [sid, o] of outcomes) {
    const s = scenarioById.get(sid);
    if (!s) continue;
    const c = map.get(s.category) ?? { pass: 0, total: 0 };
    c.total += 1;
    if (o === "pass") c.pass += 1;
    map.set(s.category, c);
  }
  return [...map.entries()].map(([category, c]) => ({ category, ...c }));
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
