"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink, Card, EmptyState, Eyebrow, LoadError, Skeleton } from "./ui";
import { ReadinessCard } from "./readiness-card";
import { MockBadge } from "./live-mission-control";
import { fetchRun, fetchRuns } from "@/lib/live-api";
import { scoreOf, type LiveRunListItem, type LiveRunSummary } from "@/lib/live-types";
import { strengthsAndWeaknesses } from "@/lib/live-analyze";
import { suiteLabel } from "@/lib/suite-tiers";

export function LiveDashboard() {
  // undefined = loading · null = fetch failed · [] = empty workspace.
  const [runs, setRuns] = useState<LiveRunListItem[] | null | undefined>(undefined);
  const [latest, setLatest] = useState<LiveRunSummary | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await fetchRuns();
      if (!list) return { list: null, full: null };
      const latestComplete = list.find((r) => r.status === "complete");
      const full = latestComplete ? await fetchRun(latestComplete.id) : null;
      return { list, full };
    })().then(({ list, full }) => {
      if (!alive) return;
      setRuns(list);
      setLatest(full);
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (runs === undefined) {
    return (
      <div className="mt-16 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (runs === null) {
    return (
      <div className="mt-16">
        <LoadError what="live runs" onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="mt-16">
        <EmptyState
          icon={
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-8">
              <rect x="5" y="9" width="22" height="16" rx="3" />
              <path d="M16 9V5M11 17h.01M21 17h.01M12 21h8" strokeLinecap="round" />
            </svg>
          }
          title="Connect your first agent to see how it holds up."
          body="Live mode runs your agent against the simulated store for real. Register an endpoint, or start immediately with the built-in reference agent."
          action={
            <div className="flex gap-3">
              <ButtonLink href="/runs">Start a run</ButtonLink>
              <ButtonLink variant="secondary" href="/agents/connect">
                Connect an agent
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  const sw = latest ? strengthsAndWeaknesses(latest) : null;

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        {runs.slice(0, 6).map((run) => {
          const score = run.score;
          const running = run.status === "running";
          const resolved =
            run.counts.pass + run.counts.fail + run.counts.partial + run.counts.error;
          return (
            <Link
              key={run.id}
              href={running ? `/runs?run=${run.id}` : `/reports?run=${run.id}`}
              className="focus-ring block rounded-xl"
            >
              <Card className="flex items-center justify-between gap-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-mut">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${running ? "animate-pulse-cell" : ""}`}
                      style={{
                        background: running
                          ? "var(--color-accent)"
                          : score >= 90
                            ? "var(--color-accent)"
                            : "var(--color-fail)",
                      }}
                    />
                    <span className="truncate text-[15px] font-medium text-ink">{run.agentName}</span>
                    <span className="font-mono text-[11px] text-mut">{run.id}</span>
                    {run.provider === "mock" && <MockBadge />}
                  </div>
                  <div className="mt-2 text-[13px] text-mut">
                    {suiteLabel(run.suite, run.total)} · {resolved.toLocaleString()}/
                    {run.total.toLocaleString()} ·{" "}
                    {running
                      ? "running now"
                      : new Date(run.startedAt).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                  </div>
                </div>
                <div className="w-20 shrink-0 text-right">
                  <span className="numeral text-4xl text-ink">{score}</span>
                  <span className="text-lg text-mut">%</span>
                </div>
              </Card>
            </Link>
          );
        })}
        <div className="pt-2">
          <Eyebrow>Live runs · newest first</Eyebrow>
        </div>
      </div>

      {latest && sw && (
        <ReadinessCard
          score={scoreOf(latest.results)}
          strengths={sw.strengths}
          weaknesses={sw.weaknesses}
          meta={`Run ${latest.id} · ${latest.results.length} scenarios · provider ${latest.provider}`}
          className="h-fit"
        />
      )}
    </div>
  );
}
