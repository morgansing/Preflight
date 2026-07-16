"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Eyebrow } from "./ui";
import { fetchRegression, pinBaseline } from "@/lib/live-api";
import type { RegressionReport, ScenarioDelta } from "@/lib/live-types";

/**
 * Versus baseline: what changed since the run you trust. Regressions
 * (got worse) lead; recoveries follow. The pin button makes this run
 * the reference for every later run of the same agent + suite — the
 * same baseline the CI gate checks against.
 */

const MAX_LISTED = 8;

const outcomeTint: Record<string, string> = {
  pass: "text-accent",
  partial: "text-warn",
  fail: "text-fail",
};

function DeltaRow({ d, runId }: { d: ScenarioDelta; runId: string }) {
  return (
    <li className="flex items-baseline gap-3 text-[13px]">
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-mut">
        <span className={outcomeTint[d.from]}>{d.from}</span>
        {" → "}
        <span className={outcomeTint[d.to]}>{d.to}</span>
      </span>
      <span className="min-w-0">
        <Link
          href={`/replay/${d.scenarioId}?run=${runId}`}
          className="focus-ring rounded text-ink hover:text-accent hover:underline"
        >
          {d.name ?? d.scenarioId}
        </Link>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-mut">
          {d.severity}
        </span>
        {d.failureReason && (
          <span className="block text-[12px] leading-relaxed text-sub">{d.failureReason}</span>
        )}
      </span>
    </li>
  );
}

export function RegressionPanel({ runId }: { runId: string }) {
  const [data, setData] = useState<{
    isBaseline: boolean;
    report: RegressionReport | null;
    reason?: string;
  } | null>(null);
  const [pinning, setPinning] = useState(false);

  const load = useCallback(() => {
    fetchRegression(runId).then(setData);
  }, [runId]);
  useEffect(load, [load]);

  const pin = async () => {
    setPinning(true);
    await pinBaseline(runId);
    setPinning(false);
    load();
  };

  if (!data) return null;
  const { isBaseline, report, reason } = data;

  const pinControl = isBaseline ? (
    <span className="rounded border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-accent">
      PINNED BASELINE
    </span>
  ) : (
    <Button type="button" variant="secondary" size="sm" onClick={pin} disabled={pinning}>
      {pinning ? "Pinning…" : "Pin as baseline"}
    </Button>
  );

  if (!report) {
    return (
      <section className="no-print mt-12 rounded-lg border border-edge p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Eyebrow>Versus baseline</Eyebrow>
            <p className="mt-2 text-[13px] leading-relaxed text-sub">{reason}</p>
            {!isBaseline && (
              <p className="mt-1 text-[12px] text-mut">
                Pin this run and every later run of this agent + suite gets diffed against it —
                in this report and in the CI gate.
              </p>
            )}
          </div>
          {pinControl}
        </div>
      </section>
    );
  }

  const delta = report.candidateScore - report.baselineScore;
  const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;
  const deltaTint = delta > 0 ? "text-accent" : delta < 0 ? "text-fail" : "text-sub";

  return (
    <section className="mt-12 rounded-lg border border-edge p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>Versus baseline</Eyebrow>
          <p className="mt-1.5 text-[13px] text-sub">
            {report.baselinePinned ? "Pinned baseline" : "Previous run"}{" "}
            <span className="font-mono text-[12px]">{report.baselineRunId}</span> ·{" "}
            {new Date(report.baselineStartedAt).toLocaleDateString("en-US", {
              dateStyle: "medium",
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm tabular-nums text-sub">
            {report.baselineScore}% → <span className="text-ink">{report.candidateScore}%</span>{" "}
            <span className={deltaTint}>({deltaLabel})</span>
          </span>
          <span className="no-print">{pinControl}</span>
        </div>
      </div>

      {report.regressions.length === 0 && report.improvements.length === 0 ? (
        <p className="mt-4 text-[13px] text-sub">
          No scenario changed outcome — {report.stillPassing} still passing,{" "}
          {report.stillFailing} still failing.
        </p>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-[13px] font-medium text-fail">
              Newly failing · {report.regressions.length}
            </div>
            <ul className="mt-3 space-y-3">
              {report.regressions.slice(0, MAX_LISTED).map((d) => (
                <DeltaRow key={d.scenarioId} d={d} runId={runId} />
              ))}
            </ul>
            {report.regressions.length > MAX_LISTED && (
              <p className="mt-2 font-mono text-[11px] text-mut">
                +{report.regressions.length - MAX_LISTED} more
              </p>
            )}
          </div>
          <div>
            <div className="text-[13px] font-medium text-accent">
              Recovered · {report.improvements.length}
            </div>
            <ul className="mt-3 space-y-3">
              {report.improvements.slice(0, MAX_LISTED).map((d) => (
                <DeltaRow key={d.scenarioId} d={d} runId={runId} />
              ))}
            </ul>
            {report.improvements.length > MAX_LISTED && (
              <p className="mt-2 font-mono text-[11px] text-mut">
                +{report.improvements.length - MAX_LISTED} more
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-5 border-t border-edge pt-3 font-mono text-[11px] tabular-nums text-mut">
        {report.stillPassing} still passing · {report.stillFailing} still failing
        {report.excludedErrors > 0 && ` · ${report.excludedErrors} excluded (run errors)`}
        {(report.onlyInBaseline > 0 || report.onlyInCandidate > 0) &&
          ` · suite drift: ${report.onlyInCandidate} new, ${report.onlyInBaseline} removed`}
      </p>
    </section>
  );
}
