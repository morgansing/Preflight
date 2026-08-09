"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ButtonLink, Card, Eyebrow, Skeleton } from "./ui";
import { MockBadge } from "./live-mission-control";
import { agoLabel } from "./live-run-history";
import { fetchRun } from "@/lib/live-api";
import { scoreOf, type LiveCellResult, type LiveRunSummary } from "@/lib/live-types";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import { suiteLabel } from "@/lib/suite-tiers";
import { DIFFICULTY_LABELS, verdictFor, type Difficulty } from "@/lib/types";
import reportStyles from "./report-surface.module.css";

/**
 * Live run detail — one real run, settled: the wall, the result strip
 * and per-category results, every cell opening its actual transcript.
 * A still-running run hands off to the live wall instead.
 */

type LiveOutcomeKey = LiveCellResult["outcome"] | "pending";

const cellStyles: Record<LiveOutcomeKey, string> = {
  pending: "bg-raised/60",
  pass: "bg-accent/12 text-accent",
  fail: "bg-fail/18 text-fail",
  partial: "bg-warn/15 text-warn",
  error: "bg-warn/10 text-warn ring-1 ring-inset ring-warn/40",
};
const cellGlyph: Record<string, string> = { pass: "✓", fail: "✗", partial: "◐", error: "!" };

export function LiveRunDetail({ runId }: { runId: string }) {
  // undefined = loading; null = not found.
  const [run, setRun] = useState<LiveRunSummary | null | undefined>(undefined);
  // Wall filter: the full run first, then one outcome at a time.
  const [filter, setFilter] = useState<"all" | "fail" | "partial" | "error">("all");

  useEffect(() => {
    fetchRun(runId).then(setRun);
  }, [runId]);

  const byId = useMemo(
    () => new Map((run?.results ?? []).map((r) => [r.scenarioId, r])),
    [run],
  );

  const categories = useMemo(() => {
    if (!run) return [];
    const map = new Map<string, { pass: number; total: number }>();
    for (const r of run.results) {
      if (r.outcome === "error") continue;
      const cat = r.category ?? getScenarioById(r.scenarioId)?.category ?? "Other";
      const c = map.get(cat) ?? { pass: 0, total: 0 };
      c.total += 1;
      if (r.outcome === "pass") c.pass += 1;
      map.set(cat, c);
    }
    return [...map.entries()]
      .map(([category, c]) => ({ category, ...c }))
      .sort((a, b) => a.pass / a.total - b.pass / b.total);
  }, [run]);

  // Library scenarios carry a difficulty grade; custom/security ids
  // without one are simply not bucketed.
  const difficulties = useMemo(() => {
    if (!run) return [];
    const map = new Map<Difficulty, { pass: number; total: number }>();
    for (const r of run.results) {
      if (r.outcome === "error") continue;
      const level = getScenarioById(r.scenarioId)?.difficulty;
      if (!level) continue;
      const b = map.get(level) ?? { pass: 0, total: 0 };
      b.total += 1;
      if (r.outcome === "pass") b.pass += 1;
      map.set(level, b);
    }
    return [...map.entries()]
      .map(([level, b]) => ({ level, ...b }))
      .sort((a, b) => a.level - b.level);
  }, [run]);

  if (run === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 px-8 py-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="mt-6 h-80 w-full" />
      </div>
    );
  }

  if (run === null) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24 text-center">
        <Eyebrow>Run</Eyebrow>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">Run not found</h1>
        <p className="mt-3 text-sm text-sub">No live run with that id.</p>
        <div className="mt-8">
          <ButtonLink href="/runs/history" variant="secondary">
            ← Back to run history
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (run.status === "running") {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24 text-center">
        <Eyebrow>Run {run.id}</Eyebrow>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
          Still running
        </h1>
        <p className="mt-3 text-sm text-sub">
          {run.agentName} is {run.results.length}/{run.scenarioIds.length} scenarios in.
        </p>
        <div className="mt-8">
          <ButtonLink href={`/runs?run=${run.id}`}>Watch it fill in live →</ButtonLink>
        </div>
      </div>
    );
  }

  const n = run.scenarioIds.length;
  const score = scoreOf(run.results);
  const counts = {
    pass: run.results.filter((r) => r.outcome === "pass").length,
    fail: run.results.filter((r) => r.outcome === "fail").length,
    partial: run.results.filter((r) => r.outcome === "partial").length,
    error: run.results.filter((r) => r.outcome === "error").length,
  };
  const cost = run.results.reduce((a, r) => a + r.costUsd, 0);
  const durationMs = run.finishedAt
    ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
    : 0;

  const shownIds =
    filter === "all"
      ? run.scenarioIds
      : run.scenarioIds.filter((id) => byId.get(id)?.outcome === filter);

  // Same scaling rules as the live wall — sized to what's shown, so
  // filtering 10,000 cells down to 5 fails renders them readably large.
  const shown = shownIds.length;
  const cols =
    shown <= 32 ? 8 : shown <= 200 ? 20 : shown <= 600 ? 30 : shown <= 1200 ? 40 : shown <= 3000 ? 60 : 100;
  const cellPx = Math.max(7, Math.min(44, Math.floor((1160 - cols * 6) / cols)));
  const gap = cellPx >= 20 ? 6 : cellPx >= 12 ? 3 : 2;
  const showGlyph = cellPx >= 16;

  return (
    <div className={reportStyles.reportPage}>
      <Link
        href="/runs/history"
        className={`focus-ring ${reportStyles.runBack}`}
      >
        ← RUN HISTORY
      </Link>

      {/* Header */}
      <header className={`${reportStyles.reportHeader} ${reportStyles.runHeader}`}>
        <div>
          <div className="flex items-center gap-3">
            <h1 className={reportStyles.reportTitle}>{run.agentName}</h1>
            {run.provider === "mock" && <MockBadge />}
          </div>
          <div className={reportStyles.reportMeta}>
            <span className="font-mono">{run.id}</span>
            <span className={reportStyles.metaDivider} aria-hidden />
            <span>{suiteLabel(run.suite, n)}</span>
            <span className={reportStyles.metaDivider} aria-hidden />
            <span>{agoLabel(run.startedAt)}</span>
            <span className={reportStyles.metaDivider} aria-hidden />
            <span>{fmtClock(durationMs)} · ${cost.toFixed(2)}</span>
          </div>
          {run.status === "error" && run.error && (
            <p className="mt-2 max-w-lg rounded-lg border border-warn/40 bg-warn/8 p-2.5 text-[13px] text-warn">
              Run error: {run.error}
            </p>
          )}
        </div>
        <div className={reportStyles.runScore}>
          <div className="numeral text-5xl text-ink">
            {score}
            <span className="text-2xl text-mut">%</span>
          </div>
          <div className={`text-sm font-medium ${score >= 90 ? "text-accent" : "text-sub"}`}>
            {verdictFor(score)}
          </div>
        </div>
      </header>

      {/* CTAs */}
      <div className={`no-print ${reportStyles.runActions}`}>
        <ButtonLink href={`/reports?run=${run.id}`} size="sm">
          Open readiness report →
        </ButtonLink>
        <ButtonLink href="/runs" variant="secondary" size="sm">
          New run →
        </ButtonLink>
      </div>

      {/* Result strip */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Passed" value={`${counts.pass}/${n}`} tone="accent" />
        <StatCard label="Failed" value={String(counts.fail)} tone={counts.fail > 0 ? "fail" : undefined} />
        <StatCard label="Partial" value={String(counts.partial)} />
        <StatCard label="Run errors" value={String(counts.error)} tone={counts.error > 0 ? "warn" : undefined} />
        <StatCard label="Duration" value={fmtClock(durationMs)} />
      </div>

      {/* The wall, settled */}
      <section className={reportStyles.reportSection}>
        <div className={reportStyles.sectionHeader}>
          <div className={reportStyles.sectionTitleGroup}>
            <span className={reportStyles.sectionIndex}>EVIDENCE / SCENARIO WALL</span>
            <h2 className={reportStyles.sectionTitle}>Every judged scenario</h2>
          </div>
          <span className={`${reportStyles.wallFilters} flex items-center gap-2 font-mono text-[11px] tabular-nums`}>
            {(
              [
                { id: "all" as const, label: `All ${n.toLocaleString()}`, cls: "text-sub" },
                { id: "fail" as const, label: `✗ ${counts.fail.toLocaleString()}`, cls: "text-fail" },
                { id: "partial" as const, label: `◐ ${counts.partial.toLocaleString()}`, cls: "text-warn" },
                ...(counts.error > 0
                  ? [{ id: "error" as const, label: `! ${counts.error.toLocaleString()}`, cls: "text-warn" }]
                  : []),
              ]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={`focus-ring h-7 cursor-pointer rounded-full border px-3 transition-colors ${
                  filter === f.id
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : `border-edge hover:border-mut ${f.cls}`
                }`}
              >
                {f.label}
              </button>
            ))}
          </span>
        </div>
        <Card className="mt-4 overflow-x-auto">
          {shownIds.length === 0 && (
            <p className="py-8 text-center text-sm text-mut">
              Nothing with that outcome in this run.
            </p>
          )}
          <div
            className="mx-auto grid w-fit"
            style={{ gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`, gap }}
            role="grid"
            aria-label="Scenario outcomes"
          >
            {shownIds.map((scenarioId) => {
              const result = byId.get(scenarioId);
              const state: LiveOutcomeKey = result?.outcome ?? "pending";
              const name = result?.name ?? getScenarioById(scenarioId)?.name ?? "";
              const title = `${scenarioId} · ${name} · ${state}`;
              const radius = cellPx >= 16 ? 5 : 2;
              const body = (
                <span
                  className={`flex items-center justify-center leading-none ${cellStyles[state]} ${
                    result ? "hover:ring-1 hover:ring-mut" : ""
                  }`}
                  style={{
                    width: cellPx,
                    height: cellPx,
                    borderRadius: radius,
                    fontSize: Math.floor(cellPx * 0.45),
                  }}
                >
                  {result && showGlyph ? cellGlyph[state] : null}
                </span>
              );
              if (!result) return <div key={scenarioId} title={title}>{body}</div>;
              return (
                <Link
                  key={scenarioId}
                  href={`/replay/${scenarioId}?run=${run.id}`}
                  title={title}
                  className="focus-ring"
                  style={{ borderRadius: radius }}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        </Card>
        <p className="mt-3 text-[12px] text-mut">
          Every cell links to the real transcript the judge scored.
        </p>
      </section>

      {/* By difficulty */}
      {difficulties.length > 1 && (
        <section className={reportStyles.reportSection}>
          <div className={reportStyles.sectionHeader}>
            <div className={reportStyles.sectionTitleGroup}>
              <span className={reportStyles.sectionIndex}>ANALYSIS / PRESSURE</span>
              <h2 className={reportStyles.sectionTitle}>By difficulty</h2>
            </div>
            <span className={reportStyles.sectionNote}>
              severity is what a miss costs · difficulty is how likely it is
            </span>
          </div>
          <Card className="mt-4 divide-y divide-edge p-0">
            {difficulties.map((d) => {
              const pct = Math.round((d.pass / d.total) * 100);
              const tint = pct === 100 ? "bg-accent" : pct >= 70 ? "bg-warn" : "bg-fail";
              return (
                <div
                  key={d.level}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3"
                >
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
      )}

      {/* Category results */}
      {categories.length > 0 && (
        <section className={reportStyles.reportSection}>
          <div className={reportStyles.sectionHeader}>
            <div className={reportStyles.sectionTitleGroup}>
              <span className={reportStyles.sectionIndex}>ANALYSIS / CAPABILITY</span>
              <h2 className={reportStyles.sectionTitle}>Category results</h2>
            </div>
            <span className={reportStyles.sectionNote}>Weakest capability areas first.</span>
          </div>
          <Card className="mt-4 divide-y divide-edge p-0">
            {categories.map((c) => {
              const pct = Math.round((c.pass / c.total) * 100);
              const tint = pct === 100 ? "bg-accent" : pct >= 70 ? "bg-warn" : "bg-fail";
              return (
                <div key={c.category} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3">
                  <span className="w-44 shrink-0 truncate text-[13px] text-ink max-sm:w-full">{c.category}</span>
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
      )}
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
  tone?: "accent" | "fail" | "warn";
}) {
  return (
    <Card className="p-4">
      <div className="eyebrow">{label}</div>
      <div
        className={`numeral mt-1 text-3xl ${
          tone === "accent"
            ? "text-accent"
            : tone === "fail"
              ? "text-fail"
              : tone === "warn"
                ? "text-warn"
                : "text-ink"
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
