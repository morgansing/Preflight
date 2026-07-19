"use client";

import { useState } from "react";
import { Button, Eyebrow } from "./ui";
import { demoAgents } from "@/lib/fixtures/agents";
import { demoSuites, type DemoSuiteId } from "@/lib/demo-runs";

/**
 * The demo-mode launcher: pick an agent and a suite, run a fake test.
 * Same ritual as the live launcher, zero setup — outcomes are
 * synthesized from the agent's canonical miss profile.
 */
export function DemoRunLauncher({
  onLaunch,
  onClose,
}: {
  onLaunch: (agentId: string, suiteId: DemoSuiteId) => void;
  onClose: () => void;
}) {
  const [agentId, setAgentId] = useState(demoAgents[0].id);
  const [suiteId, setSuiteId] = useState<DemoSuiteId>("smoke");

  return (
    <div className="border-b border-edge bg-surface px-8 py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-end gap-6">
        <label className="block min-w-56 space-y-2">
          <Eyebrow>Agent under test</Eyebrow>
          <select
            className="focus-ring w-full rounded-lg border border-edge bg-raised px-3.5 py-2.5 text-sm text-ink outline-none"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            {demoAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.version} — {a.scoreHistory[a.scoreHistory.length - 1]}%
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <Eyebrow>Suite</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {demoSuites().map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={suiteId === s.id}
                onClick={() => setSuiteId(s.id)}
                title={s.blurb}
                className={`focus-ring h-9 cursor-pointer rounded-lg border px-3 font-mono text-[12px] tabular-nums transition-colors ${
                  suiteId === s.id
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-edge text-sub hover:border-mut hover:text-ink"
                }`}
              >
                {s.name} · {s.scenarioIds.length}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onLaunch(agentId, suiteId)}>
            Start fake test →
          </Button>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-5xl text-[12px] text-mut">
        A simulated demo run — outcomes are drawn from this agent&apos;s real weak spots, and
        the finished run joins the run history. For a genuine evaluation, switch to Live mode.
      </p>
    </div>
  );
}
