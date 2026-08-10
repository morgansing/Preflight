"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReplayView, type ReplayLike } from "@/app/(app)/replay/[id]/replay-view";
import { LiveEmpty } from "./live-empty";
import { LoadError, Skeleton } from "./ui";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import type { LiveReplayPayload } from "@/lib/live-types";
import type { Scenario } from "@/lib/types";

type ReplayState =
  | { phase: "loading"; requestKey: string }
  | { phase: "missing"; requestKey: string }
  | { phase: "error"; requestKey: string }
  | {
      phase: "ready";
      requestKey: string;
      scenario: Scenario;
      replay: ReplayLike;
      runId: string;
    };

async function requestLiveReplay(
  runId: string,
  scenarioId: string,
  signal: AbortSignal,
): Promise<LiveReplayPayload | null> {
  const response = await fetch(
    `/api/live/results/${encodeURIComponent(runId)}/${encodeURIComponent(scenarioId)}`,
    { signal },
  );
  if (!response.ok) return null;
  return response.json() as Promise<LiveReplayPayload>;
}

/** Live replay: the persisted transcript of a real run, in the same
 * three-column view the demo uses. */
export function LiveReplay({ scenarioId }: { scenarioId: string }) {
  return (
    <Suspense fallback={<ReplayLoading />}>
      <LiveReplayContent scenarioId={scenarioId} />
    </Suspense>
  );
}

function LiveReplayContent({ scenarioId }: { scenarioId: string }) {
  const searchParams = useSearchParams();
  const runId = searchParams.get("run");
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReplayState>({ phase: "loading", requestKey: "" });
  const currentRequestKey = `${scenarioId}:${runId ?? ""}:${attempt}`;

  useEffect(() => {
    if (!runId) return;

    const requestKey = `${scenarioId}:${runId}:${attempt}`;
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const payload = await requestLiveReplay(runId, scenarioId, controller.signal);
        if (cancelled) return;
        if (!payload) {
          setState({ phase: "missing", requestKey });
          return;
        }

        // Base scenarios resolve by id; generated custom scenarios come
        // from the snapshot the result carries.
        const base = getScenarioById(scenarioId);
        const scenario: Scenario | null = base
          ? base
          : payload.snapshot
            ? {
                id: scenarioId,
                name: payload.snapshot.name,
                category: payload.snapshot.category,
                severity: payload.severity,
                // Snapshots predate difficulty grading — default to the middle.
                difficulty: 3,
                rubric: payload.snapshot.rubric,
                persona: "",
                openingMessage: "",
                hiddenFacts: [],
                passCriteria: payload.snapshot.passCriteria,
                mustNot: payload.snapshot.mustNot,
              }
            : null;
        if (!scenario) {
          setState({ phase: "missing", requestKey });
          return;
        }

        setState({
          phase: "ready",
          requestKey,
          scenario,
          runId,
          replay: {
            scenarioId,
            outcome: payload.outcome,
            severity: payload.severity,
            tokens: payload.tokens,
            costUsd: payload.costUsd,
            latencyMs: payload.latencyMs,
            steps: payload.steps,
            expectedPath: [
              ...scenario.passCriteria.map((text) => ({ text, kind: "must" as const })),
              ...scenario.mustNot.map((text) => ({ text, kind: "must_not" as const })),
            ],
            divergenceStep: payload.divergenceStep,
            divergenceExpected: payload.divergenceExpected,
            failureReason: payload.failureReason,
            criteriaMet: payload.criteriaMet,
            criteriaViolated: payload.criteriaViolated,
            evidence: payload.evidence,
          },
        });
      } catch {
        if (!cancelled) setState({ phase: "error", requestKey });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt, runId, scenarioId]);

  if (!runId) return <LiveEmpty surface="this replay" />;

  const currentState = state.requestKey === currentRequestKey
    ? state
    : { phase: "loading" as const, requestKey: currentRequestKey };

  if (currentState.phase === "loading") return <ReplayLoading />;
  if (currentState.phase === "missing") return <LiveEmpty surface="this replay" />;
  if (currentState.phase === "error") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 sm:px-8">
        <LoadError what="this replay" onRetry={() => setAttempt((value) => value + 1)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {currentState.replay.outcome === "error" && (
        <div className="border-b border-warn/40 bg-warn/8 px-5 py-3 text-[13px] text-warn sm:px-8">
          <span className="font-mono text-[11px] tracking-wider">RUN ERROR</span>
          <span className="ml-3">{currentState.replay.failureReason}</span>
          <span className="ml-3 text-warn/70">
            Infrastructure failure — excluded from the score; not an agent failure.
          </span>
        </div>
      )}
      <ReplayView
        scenario={currentState.scenario}
        replay={currentState.replay}
        sourceRunId={currentState.runId}
      />
    </div>
  );
}

function ReplayLoading() {
  return (
    <section
      className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading replay evidence"
    >
      <div className="flex items-center justify-between gap-4 border-b border-edge pb-5">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="mt-3 h-5 max-w-sm" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mt-5 grid gap-1 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-edge bg-surface/70 p-4">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-5 h-24 w-full" />
            <Skeleton className="mt-3 h-16 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading replay evidence…</span>
    </section>
  );
}
