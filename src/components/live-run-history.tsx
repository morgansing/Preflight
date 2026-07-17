"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink, EmptyState, Skeleton } from "./ui";
import { MockBadge } from "./live-mission-control";
import { fetchRuns } from "@/lib/live-api";
import type { LiveRunListItem } from "@/lib/live-types";
import { suiteLabel } from "@/lib/suite-tiers";

/** "3m ago" / "2h ago" / "5d ago" from an ISO timestamp. */
export function agoLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Live run history — the ledger of real runs, from the database. Each
 * row opens the run: finished runs get their detail page, a running one
 * attaches to the live wall.
 */
export function LiveRunHistory() {
  // undefined = loading
  const [runs, setRuns] = useState<LiveRunListItem[] | undefined>(undefined);

  useEffect(() => {
    fetchRuns().then(setRuns);
  }, []);

  if (runs === undefined) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 px-8 py-10">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24">
        <EmptyState
          icon={
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-8">
              <circle cx="16" cy="16" r="12.5" />
              <path d="M13.5 11.5l7 4.5-7 4.5z" fill="currentColor" stroke="none" />
            </svg>
          }
          title="No live runs yet."
          body="Run history fills in as you run agents against the store — sandbox runs count too, and they're free."
          action={<ButtonLink href="/runs">Start a run</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Run history</h1>
          <p className="mt-2 text-sm text-sub">
            The last {runs.length} live runs, newest first — every row opens the run.
          </p>
        </div>
        <ButtonLink href="/runs" variant="secondary">
          New run →
        </ButtonLink>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-edge">
        <div className="hidden border-b border-edge bg-surface px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-mut md:grid md:grid-cols-[minmax(0,1fr)_10rem_5rem_5.5rem_7rem_5rem]">
          <span>Agent · run</span>
          <span>Suite</span>
          <span className="text-right">Score</span>
          <span className="text-right">Passed</span>
          <span className="text-right">Misses</span>
          <span className="text-right">When</span>
        </div>
        <div className="divide-y divide-edge/60">
          {runs.map((r) => {
            const running = r.status === "running";
            const href = running ? `/runs?run=${r.id}` : `/runs/${r.id}`;
            return (
              <Link
                key={r.id}
                href={href}
                className="focus-ring grid grid-cols-2 items-center gap-y-1 px-5 py-3 text-[13px] transition-colors hover:bg-surface md:grid-cols-[minmax(0,1fr)_10rem_5rem_5.5rem_7rem_5rem]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    {running && (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent animate-pulse-cell" />
                    )}
                    <span className="truncate text-ink">{r.agentName}</span>
                    {r.provider === "mock" && <MockBadge />}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-mut">
                    {r.id}
                    {running && " · running"}
                    {r.status === "error" && <span className="text-warn"> · run error</span>}
                  </span>
                </span>
                <span className="min-w-0 truncate text-sub">{suiteLabel(r.suite, r.total)}</span>
                <span className="text-right">
                  <span className="numeral text-lg text-ink">{r.score}</span>
                  <span className="text-[12px] text-mut">%</span>
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums text-sub">
                  {r.counts.pass}/{r.total}
                </span>
                <span className="text-right font-mono text-[12px] tabular-nums">
                  <span className={r.counts.fail > 0 ? "text-fail" : "text-mut"}>
                    ✗ {r.counts.fail}
                  </span>
                  {r.counts.partial > 0 && <span className="text-warn"> ◐ {r.counts.partial}</span>}
                  {r.counts.error > 0 && <span className="text-warn"> ! {r.counts.error}</span>}
                </span>
                <span className="text-right font-mono text-[12px] text-mut">
                  {agoLabel(r.startedAt)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-[12px] text-mut">
        Every scenario in a live run keeps its full transcript — open a run and click any
        cell to replay it.
      </p>
    </div>
  );
}
