"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Eyebrow, Skeleton } from "@/components/ui";
import { suiteLabel } from "@/lib/suite-tiers";
import { verdictFor } from "@/lib/types";

/**
 * The public share page — what a badge click lands on. Read-only, no
 * nav, no workspace: the score, the shape of the run, and Preflight's
 * name on it. Transcripts and replays deliberately stay private.
 */

interface SharedReport {
  agentName: string;
  suite: string;
  scenarioCount: number;
  score: number;
  startedAt: string;
  counts: { pass: number; fail: number; partial: number; error: number };
  categories: { category: string; pass: number; total: number }[];
  outcomes: { scenarioId: string; outcome: "pass" | "fail" | "partial" | "error" }[];
}

const cellTint: Record<string, string> = {
  pass: "bg-accent/12",
  fail: "bg-fail/25",
  partial: "bg-warn/20",
  error: "bg-warn/10",
};

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [report, setReport] = useState<SharedReport | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setReport)
      .catch(() => setReport(null));
  }, [token]);

  if (report === undefined) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-8 py-24">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (report === null) {
    return (
      <div className="mx-auto max-w-xl px-8 py-32 text-center">
        <Eyebrow>Preflight</Eyebrow>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
          Unknown share link
        </h1>
        <p className="mt-3 text-sm text-sub">
          This link may have been revoked, or the run no longer exists.
        </p>
      </div>
    );
  }

  const n = report.outcomes.length;
  const cols = n <= 32 ? 8 : n <= 200 ? 20 : n <= 600 ? 30 : 40;

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-mut">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          PREFLIGHT · VERIFIED RESULT
        </span>
        <span className="font-mono text-[11px] text-mut">
          {new Date(report.startedAt).toLocaleDateString("en-US", { dateStyle: "long" })}
        </span>
      </div>

      <h1 className="font-display mt-6 text-4xl tracking-tight text-ink">{report.agentName}</h1>
      <p className="mt-2 text-sm text-sub">{suiteLabel(report.suite, report.scenarioCount)}</p>

      <div className="mt-10 rounded-xl border border-edge bg-surface p-8 text-center shadow-card">
        <div className="numeral text-[72px] leading-none text-ink">
          {report.score}
          <span className="text-[32px] text-sub">%</span>
        </div>
        <div
          className={`mt-3 text-sm font-medium ${report.score >= 90 ? "text-accent" : "text-sub"}`}
        >
          {verdictFor(report.score)}
        </div>
        <p className="mt-4 font-mono text-[12px] tabular-nums text-mut">
          ✓ {report.counts.pass} · ✗ {report.counts.fail} · ◐ {report.counts.partial}
          {report.counts.error > 0 && ` · ! ${report.counts.error}`}
        </p>
      </div>

      {/* The wall, miniature and read-only. */}
      <div className="mt-6 rounded-xl border border-edge bg-surface p-6">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          aria-label="Scenario outcomes"
        >
          {report.outcomes.map((o) => (
            <span
              key={o.scenarioId}
              className={`aspect-square rounded-[2px] ${cellTint[o.outcome] ?? "bg-raised"}`}
            />
          ))}
        </div>
      </div>

      {report.categories.length > 0 && (
        <div className="mt-6 rounded-xl border border-edge bg-surface p-6">
          <Eyebrow>By category</Eyebrow>
          <div className="mt-4 space-y-2.5">
            {report.categories.map((c) => {
              const pct = Math.round((c.pass / c.total) * 100);
              const tint = pct === 100 ? "bg-accent" : pct >= 70 ? "bg-warn" : "bg-fail";
              return (
                <div key={c.category} className="flex items-center gap-4">
                  <span className="w-44 shrink-0 text-[13px] text-sub">{c.category}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                    <div className={`h-full rounded-full ${tint}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[12px] tabular-nums text-mut">
                    {c.pass}/{c.total}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-[13px] text-sub">
        This agent was evaluated by{" "}
        <Link href="/" className="focus-ring rounded font-medium text-accent hover:underline">
          Preflight
        </Link>{" "}
        — a flight simulator for AI agents. Transcripts stay private to the workspace.
      </p>
    </div>
  );
}
