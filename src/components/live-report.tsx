"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReadinessCard } from "./readiness-card";
import { RegressionPanel } from "./regression-panel";
import { RootCauses } from "./root-causes";
import { UpgradeNudge } from "./upgrade-nudge";
import { Button, ButtonLink, EmptyState, Eyebrow, LoadError, Skeleton } from "./ui";
import { MockBadge } from "./live-mission-control";
import { fetchRun, fetchRuns } from "@/lib/live-api";
import { scoreOf, type LiveRunSummary } from "@/lib/live-types";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import { suiteLabel } from "@/lib/suite-tiers";

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** The live readiness report — computed from a real run's results. */
export function LiveReport() {
  // undefined = loading · "failed" = fetch failed · null = nothing to report.
  const [run, setRun] = useState<LiveRunSummary | null | undefined | "failed">(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("run");
    (async (): Promise<LiveRunSummary | null | "failed"> => {
      const list = await fetchRuns();
      if (!list) return "failed";
      const targetId = param ?? list.find((r) => r.status === "complete")?.id;
      return targetId ? await fetchRun(targetId) : null;
    })().then(setRun);
  }, [attempt]);

  const report = useMemo(() => {
    if (!run || run === "failed") return null;
    const results = run.results;
    const byCategory = new Map<string, { pass: number; fail: number; partial: number; total: number }>();
    const catOf = (r: (typeof results)[number]) =>
      r.category ?? getScenarioById(r.scenarioId)?.category ?? "Other";
    for (const r of results) {
      if (r.outcome === "error") continue;
      const cat = catOf(r);
      const c = byCategory.get(cat) ?? { pass: 0, fail: 0, partial: 0, total: 0 };
      c.total += 1;
      if (r.outcome === "pass") c.pass += 1;
      else if (r.outcome === "fail") c.fail += 1;
      else c.partial += 1;
      byCategory.set(cat, c);
    }
    const cats = [...byCategory.entries()];
    const strengths = cats
      .filter(([, c]) => c.fail === 0 && c.partial === 0)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name]) => name);
    const weaknesses = cats
      .filter(([, c]) => c.fail > 0)
      .sort((a, b) => b[1].fail / b[1].total - a[1].fail / a[1].total)
      .map(([name]) => name);
    const risks = results
      .filter((r) => r.outcome === "fail")
      .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
      .slice(0, 5);
    const errors = results.filter((r) => r.outcome === "error");
    const tokens = results.reduce((a, r) => a + r.tokens, 0);
    const cost = results.reduce((a, r) => a + r.costUsd, 0);
    return { score: scoreOf(results), strengths, weaknesses, risks, errors, tokens, cost };
  }, [run]);

  if (run === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-8 py-16">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (run === "failed") {
    return (
      <div className="mx-auto max-w-3xl px-8 py-24">
        <LoadError what="the live report" onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }
  if (!run || !report) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24">
        <EmptyState
          icon={
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-8">
              <path d="M8 3h12l6 6v19a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z" />
              <path d="M12 17h8M12 22h5" strokeLinecap="round" />
            </svg>
          }
          title="No completed live runs yet."
          body="Reports read from real transcripts. Run the agent against the store and the readiness report writes itself."
          action={<ButtonLink href="/runs">Start a run</ButtonLink>}
        />
      </div>
    );
  }

  const counts = {
    pass: run.results.filter((r) => r.outcome === "pass").length,
    fail: run.results.filter((r) => r.outcome === "fail").length,
    partial: run.results.filter((r) => r.outcome === "partial").length,
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Eyebrow>Readiness report · {run.id}</Eyebrow>
            {run.provider === "mock" && <MockBadge />}
          </div>
          <h1 className="font-display mt-3 text-4xl tracking-tight text-ink">{run.agentName}</h1>
          <p className="mt-2 text-sm text-sub">
            {suiteLabel(run.suite, run.scenarioIds.length)} ·{" "}
            {new Date(run.startedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
          Print / share
        </Button>
      </div>

      <div className="mt-10">
        <ReadinessCard
          score={report.score}
          strengths={report.strengths}
          weaknesses={report.weaknesses}
          meta={`${run.results.length} scenarios · ${counts.pass} passed · ${counts.fail} failed · ${counts.partial} partial${report.errors.length ? ` · ${report.errors.length} run error` : ""} · ${report.tokens.toLocaleString()} tok · $${report.cost.toFixed(2)}`}
        />
      </div>

      <UpgradeNudge simsThisRun={run.results.length} />

      <RegressionPanel runId={run.id} />

      <RootCauses runId={run.id} />

      {report.risks.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl tracking-tight text-ink">
            The {report.risks.length} risks that matter
          </h2>
          <ol className="mt-6 space-y-6">
            {report.risks.map((risk, i) => {
              const name = risk.name ?? getScenarioById(risk.scenarioId)?.name ?? risk.scenarioId;
              return (
                <li key={risk.scenarioId} className="flex gap-5">
                  <span className="numeral mt-0.5 text-2xl text-mut">{i + 1}</span>
                  <div>
                    <h3 className="text-[15px] font-medium text-ink">
                      {name}
                      <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-sub">
                        {risk.severity}
                      </span>
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-sub">{risk.failureReason}</p>
                    <Link
                      href={`/replay/${risk.scenarioId}?run=${run.id}`}
                      className="focus-ring no-print mt-2 inline-block rounded text-[13px] text-accent hover:underline"
                    >
                      Watch the replay →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {report.errors.length > 0 && (
        <section className="mt-12 rounded-lg border border-warn/40 bg-warn/8 p-5">
          <Eyebrow>Run errors · excluded from the score</Eyebrow>
          <ul className="mt-3 space-y-1.5 text-[13px] text-warn">
            {report.errors.map((e) => (
              <li key={e.scenarioId}>
                <span className="font-mono">{e.scenarioId}</span> — {e.failureReason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-20 border-t border-edge pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-[12px] text-mut">
          <span>
            {run.agentName} · {run.agentKind} · provider {run.provider}
          </span>
          <span>
            score <span className="text-ink">{report.score}%</span> ·{" "}
            {new Date(run.startedAt).toISOString().slice(0, 10)} · generated by Preflight
          </span>
        </div>
      </section>
    </div>
  );
}
