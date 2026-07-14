"use client";

import { useEffect, useState } from "react";
import { ReplayView, type ReplayLike } from "@/app/(app)/replay/[id]/replay-view";
import { LiveEmpty } from "./live-empty";
import { fetchLiveReplay } from "@/lib/live-api";
import { scenarioById } from "@/lib/fixtures/scenarios";
import type { Scenario } from "@/lib/types";

/** Live replay: the persisted transcript of a real run, in the same
 * three-column view the demo uses. */
export function LiveReplay({ scenarioId }: { scenarioId: string }) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "missing" }
    | { phase: "ready"; scenario: Scenario; replay: ReplayLike; runId: string }
  >({ phase: "loading" });

  useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get("run");
    const scenario = scenarioById.get(scenarioId);
    const load = async (): Promise<typeof state> => {
      if (!runId || !scenario) return { phase: "missing" };
      const payload = await fetchLiveReplay(runId, scenarioId);
      if (!payload) return { phase: "missing" };
      return {
        phase: "ready",
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
        },
      };
    };
    load().then(setState);
  }, [scenarioId]);

  if (state.phase === "loading") return null;
  if (state.phase === "missing") return <LiveEmpty surface="this replay" />;

  return (
    <div className="flex min-h-screen flex-col">
      {state.replay.outcome === "error" && (
        <div className="border-b border-warn/40 bg-warn/8 px-8 py-3 text-[13px] text-warn">
          <span className="font-mono text-[11px] tracking-wider">RUN ERROR</span>
          <span className="ml-3">{state.replay.failureReason}</span>
          <span className="ml-3 text-warn/70">
            Infrastructure failure — excluded from the score; not an agent failure.
          </span>
        </div>
      )}
      <ReplayView scenario={state.scenario} replay={state.replay} />
    </div>
  );
}
