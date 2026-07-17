"use client";

import Link from "next/link";
import { use } from "react";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { LiveEmpty } from "@/components/live-empty";
import { Sparkline } from "@/components/sparkline";
import { demoAgents } from "@/lib/fixtures/agents";
import { runsByAgent } from "@/lib/fixtures/runs";
import { failingReplayId } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";
import { verdictFor } from "@/lib/types";

/**
 * Agent detail — the drill-down behind each agent card. Its readiness
 * trend, a per-category performance breakdown, a run history, and the
 * areas to fix first, each linking to a replay. Demo-mode fixture data.
 */
export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useMode();
  const agent = demoAgents.find((a) => a.id === id);

  if (mode === "live") return <LiveEmpty surface="each agent's detail page" />;

  if (!agent) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24 text-center">
        <Eyebrow>Agent</Eyebrow>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">Agent not found</h1>
        <p className="mt-3 text-sm text-sub">This agent isn&apos;t in the demo workspace.</p>
        <div className="mt-8">
          <ButtonLink href="/agents" variant="secondary">
            ← Back to agents
          </ButtonLink>
        </div>
      </div>
    );
  }

  const score = agent.scoreHistory[agent.scoreHistory.length - 1];
  const ready = score >= agent.threshold;
  const breakdown = agent.breakdown ?? [];
  const worst = [...breakdown].filter((b) => b.pass < b.total).sort(
    (a, b) => a.pass / a.total - b.pass / b.total,
  );
  // A replay link should show the failure it advertises; categories
  // with no failing replay on file get no link.
  const repScenario = failingReplayId;

  const history = runsByAgent.get(agent.id) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <Link
        href="/agents"
        className="focus-ring rounded font-mono text-[11px] tracking-wider text-mut hover:text-sub"
      >
        ← AGENTS
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: ready ? "var(--color-accent)" : "var(--color-fail)" }}
            />
            <h1 className="font-display text-3xl tracking-tight text-ink">
              {agent.name} <span className="text-sub">{agent.version}</span>
            </h1>
          </div>
          <p className="mt-2 font-mono text-[12px] text-mut">
            {agent.connection} · deployment threshold {agent.threshold}% · last run{" "}
            {agent.lastRun.agoLabel}
          </p>
          {agent.note && <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-sub">{agent.note}</p>}
        </div>
        <div className="text-right">
          <div className="numeral text-5xl text-ink">
            {score}
            <span className="text-2xl text-mut">%</span>
          </div>
          <div className={`text-sm font-medium ${ready ? "text-accent" : "text-sub"}`}>
            {verdictFor(score)}
          </div>
          <div className="mt-2 flex justify-end">
            <Sparkline values={agent.scoreHistory} threshold={agent.threshold} width={140} height={36} />
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/reports" size="sm">
          Open readiness report →
        </ButtonLink>
        <ButtonLink href="/runs" variant="secondary" size="sm">
          View the run wall →
        </ButtonLink>
        <ButtonLink href="/benchmark" variant="secondary" size="sm">
          Compare versions →
        </ButtonLink>
      </div>

      {/* Category performance */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Category performance</h2>
          <span className="font-mono text-[11px] text-mut">
            {agent.lastRun.passed} / {agent.lastRun.total} scenarios passed
          </span>
        </div>
        <Card className="mt-4 divide-y divide-edge p-0">
          {[...breakdown]
            .sort((a, b) => a.pass / a.total - b.pass / b.total)
            .map((b) => {
              const pct = Math.round((b.pass / b.total) * 100);
              const tint = pct === 100 ? "bg-accent" : pct >= 70 ? "bg-warn" : "bg-fail";
              const rep = b.pass < b.total ? repScenario(b.category) : undefined;
              const Row = (
                <div className="flex items-center gap-4 px-5 py-3">
                  <span className="w-44 shrink-0 text-[13px] text-ink">{b.category}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                    <div className={`h-full rounded-full ${tint}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-sub">
                    {b.pass}/{b.total}
                  </span>
                  {rep ? (
                    <span className="w-24 shrink-0 text-right font-mono text-[11px] text-accent">
                      replay →
                    </span>
                  ) : (
                    <span aria-hidden className="w-24 shrink-0" />
                  )}
                </div>
              );
              return rep ? (
                <Link
                  key={b.category}
                  href={`/replay/${rep}`}
                  className="focus-ring block transition-colors hover:bg-surface"
                >
                  {Row}
                </Link>
              ) : (
                <div key={b.category}>{Row}</div>
              );
            })}
        </Card>
      </section>

      {/* Fix these first */}
      {worst.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl text-ink">Fix these first</h2>
          <div className="mt-4 space-y-3">
            {worst.slice(0, 3).map((b, i) => {
              const rep = repScenario(b.category);
              return (
                <div key={b.category} className="flex items-baseline gap-4 rounded-lg border border-edge bg-surface p-4">
                  <span className="numeral text-2xl text-mut">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium text-ink">{b.category}</div>
                    <p className="mt-0.5 text-[13px] text-sub">
                      Fails {b.total - b.pass} of {b.total} — a{" "}
                      {Math.round(((b.total - b.pass) / b.total) * 100)}% miss rate in this category.
                    </p>
                  </div>
                  {rep && (
                    <Link
                      href={`/replay/${rep}`}
                      className="focus-ring shrink-0 rounded text-[13px] text-accent hover:underline"
                    >
                      Watch a replay →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Run history */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ink">Run history</h2>
          <Link
            href="/runs/history"
            className="focus-ring rounded font-mono text-[11px] text-accent hover:underline"
          >
            all runs →
          </Link>
        </div>
        <Card className="mt-4 divide-y divide-edge p-0">
          {history.map((r) => {
            const above = r.score >= agent.threshold;
            return (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="focus-ring flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface"
              >
                <span className="w-24 shrink-0 font-mono text-[12px] text-mut">{r.label}</span>
                <span className="numeral w-14 shrink-0 text-lg text-ink">{r.score}%</span>
                <span
                  className={`w-16 shrink-0 font-mono text-[11px] tabular-nums ${
                    r.delta !== undefined && r.delta > 0
                      ? "text-accent"
                      : r.delta !== undefined && r.delta < 0
                        ? "text-fail"
                        : "text-mut"
                  }`}
                >
                  {r.delta === undefined || r.delta === 0 ? "—" : r.delta > 0 ? `+${r.delta}` : r.delta}
                </span>
                <span className={`flex-1 text-[12px] ${above ? "text-sub" : "text-mut"}`}>
                  {above ? "cleared the bar" : "below threshold"}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-accent">
                  {r.id} →
                </span>
              </Link>
            );
          })}
        </Card>
      </section>
    </div>
  );
}
