"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SeverityLabel } from "./ui";
import { fetchClusters } from "@/lib/live-api";
import type { ClusterReport } from "@/lib/live-types";

/**
 * The diagnosis section: N problems, not a list of failures. Each
 * cluster is a named behaviour with the judge's grouping behind it,
 * a suggested fix, and replays as proof.
 */

const MAX_MEMBER_LINKS = 3;

export function RootCauses({ runId }: { runId: string }) {
  const [report, setReport] = useState<ClusterReport | null | undefined>(undefined);

  useEffect(() => {
    fetchClusters(runId).then((r) => setReport(r ?? null));
  }, [runId]);

  if (!report || report.clusters.length === 0) return null;

  const methodLabel =
    report.method === "llm"
      ? report.provider === "anthropic"
        ? "grouped by violated criterion · named by Preflight's judge model"
        : "grouped by violated criterion · named deterministically (mock provider)"
      : "grouped by violated criterion · deterministic labels";

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          {report.clusters.length === 1
            ? "One problem, not " + report.failures + " failures"
            : `${report.clusters.length} problems, not ${report.failures} failures`}
        </h2>
        <span className="font-mono text-[11px] text-mut">{methodLabel}</span>
      </div>

      <div className="mt-6 space-y-5">
        {report.clusters.map((c, i) => (
          <article key={c.id} className="rounded-xl border border-edge bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-4">
                <span className="numeral shrink-0 text-2xl text-mut">{i + 1}</span>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-medium leading-snug text-ink">{c.title}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-mut">
                    <SeverityLabel severity={c.severity} />
                    <span className="tabular-nums">
                      {c.count} scenario{c.count === 1 ? "" : "s"}
                    </span>
                    <span className="truncate">{c.categories.join(" · ")}</span>
                  </div>
                </div>
              </div>
              <span className="numeral shrink-0 text-3xl tabular-nums text-fail/80">
                {c.count}
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-sub">{c.rootCause}</p>

            <div className="mt-4 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.14em] text-accent">
                TRY THIS
              </span>
              <p className="mt-1 text-[13px] leading-relaxed text-sub">{c.fix}</p>
            </div>

            <div className="no-print mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <span className="font-mono text-[10px] tracking-[0.14em] text-mut">PROOF</span>
              {c.members.slice(0, MAX_MEMBER_LINKS).map((m) => (
                <Link
                  key={m.scenarioId}
                  href={`/replay/${m.scenarioId}?run=${runId}`}
                  className="focus-ring rounded text-accent hover:underline"
                >
                  {m.name ?? m.scenarioId} →
                </Link>
              ))}
              {c.members.length > MAX_MEMBER_LINKS && (
                <span className="font-mono text-[11px] text-mut">
                  +{c.members.length - MAX_MEMBER_LINKS} more replays
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
