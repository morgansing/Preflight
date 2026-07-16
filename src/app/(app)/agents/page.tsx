"use client";

import { ButtonLink, Card, EmptyState, Eyebrow } from "@/components/ui";
import { Sparkline } from "@/components/sparkline";
import { demoAgents } from "@/lib/fixtures/agents";
import { useLiveAgents, type ConnectionKind } from "@/lib/live";
import { useMode } from "@/lib/mode";

const kindLabels: Record<ConnectionKind, string> = {
  openai: "OpenAI-compatible endpoint",
  http: "HTTP endpoint",
  mcp: "MCP endpoint",
  reference: "Reference agent",
};

export default function AgentsPage() {
  const { mode } = useMode();
  const live = useLiveAgents();

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Agents</h1>
          <p className="mt-2 text-sm text-sub">
            {mode === "demo"
              ? "Agents under test in the demo workspace."
              : "Agents registered for live runs against the simulated store."}
          </p>
        </div>
        <ButtonLink href="/agents/connect">Connect an agent</ButtonLink>
      </div>

      <div className="mt-10 space-y-4">
        {mode === "demo" ? (
          demoAgents.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-6">
              <div>
                <div className="text-[15px] font-medium text-ink">
                  {a.name} <span className="text-sub">{a.version}</span>
                </div>
                <div className="mt-1.5 font-mono text-[12px] text-mut">
                  {a.connection} · threshold {a.threshold}% · last run{" "}
                  {a.lastRun.agoLabel}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Sparkline values={a.scoreHistory} threshold={a.threshold} />
                <div className="w-16 text-right">
                  <span className="numeral text-3xl text-ink">
                    {a.scoreHistory[a.scoreHistory.length - 1]}
                  </span>
                  <span className="text-base text-mut">%</span>
                </div>
              </div>
            </Card>
          ))
        ) : live.agents.length === 0 ? (
          <EmptyState
            icon={
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-8">
                <rect x="5" y="9" width="22" height="16" rx="3" />
                <path d="M16 9V5M11 17h.01M21 17h.01M12 21h8" strokeLinecap="round" />
              </svg>
            }
            title="Connect your first agent to see how it holds up."
            body="Register an HTTP or MCP endpoint, or use the built-in reference agent — live runs work out of the box with no external agent."
            action={<ButtonLink href="/agents/connect">Connect an agent</ButtonLink>}
          />
        ) : (
          live.agents.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-6">
              <div>
                <div className="text-[15px] font-medium text-ink">{a.name}</div>
                <div className="mt-1.5 font-mono text-[12px] text-mut">
                  {kindLabels[a.kind]}
                  {a.endpoint ? ` · ${a.endpoint}` : ""}
                </div>
              </div>
              <div className="text-right">
                <Eyebrow>No runs yet</Eyebrow>
                <p className="mt-1 max-w-56 text-[12px] leading-relaxed text-mut">
                  The live harness runs this agent against the simulated store
                  once a provider key is configured.
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
