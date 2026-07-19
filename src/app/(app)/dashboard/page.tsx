"use client";

import Link from "next/link";
import { ReadinessCard } from "@/components/readiness-card";
import { Sparkline } from "@/components/sparkline";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { LiveDashboard } from "@/components/live-dashboard";
import { demoAgents } from "@/lib/fixtures/agents";
import { readiness } from "@/lib/fixtures/run";
import { failingReplayId } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";

/** Weakness → its failing replay, so the readiness card clicks through. */
const weaknessHrefs = Object.fromEntries(
  readiness.weaknesses.map((w) => {
    const id = failingReplayId(w);
    return [w, id && `/replay/${id}`];
  }),
);

export default function DashboardPage() {
  const { mode } = useMode();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-sub">
            Agents under test, and how close each is to shipping.
          </p>
        </div>
        <ButtonLink href="/runs">New run</ButtonLink>
      </div>

      {mode === "live" ? (
        <LiveDashboard />
      ) : (
        <>
          <DemoStats />
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            {demoAgents.map((agent, i) => {
              const score = agent.scoreHistory[agent.scoreHistory.length - 1];
              const above = score >= agent.threshold;
              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="focus-ring block rounded-xl"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <Card className="animate-fade-up flex items-center justify-between gap-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-mut">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{
                            background: above
                              ? "var(--color-accent)"
                              : "var(--color-fail)",
                          }}
                        />
                        <span className="truncate text-[15px] font-medium text-ink">
                          {agent.name}{" "}
                          <span className="text-sub">{agent.version}</span>
                        </span>
                      </div>
                      <div className="mt-2 text-[13px] text-mut">
                        {agent.connection} · {agent.lastRun.passed} /{" "}
                        {agent.lastRun.total} passed ·{" "}
                        <span className={agent.lastRun.critical > 0 ? "text-sub" : ""}>
                          {agent.lastRun.critical} critical
                        </span>{" "}
                        · {agent.lastRun.agoLabel}
                      </div>
                      {agent.note && (
                        <div className="mt-1 text-[12px] leading-snug text-mut/80">
                          {agent.note}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4 sm:gap-6">
                      <span className="hidden sm:block">
                        <Sparkline
                          values={agent.scoreHistory}
                          threshold={agent.threshold}
                        />
                      </span>
                      <div className="w-20 text-right">
                        <span className="numeral text-4xl text-ink">{score}</span>
                        <span className="text-lg text-mut">%</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}

            <div className="pt-2">
              <Eyebrow>Deployment threshold · 90%</Eyebrow>
            </div>
          </div>

          <ReadinessCard
            score={readiness.score}
            strengths={readiness.strengths}
            weaknesses={readiness.weaknesses}
            meta={readiness.meta}
            hrefs={weaknessHrefs}
            reportHref="/reports"
            className="animate-fade-up h-fit"
          />
          </div>
        </>
      )}
    </div>
  );
}

/** A compact metrics strip above the demo agent list — every tile opens
 * the view behind its number. */
function DemoStats() {
  const scores = demoAgents.map((a) => a.scoreHistory[a.scoreHistory.length - 1]);
  const readyToShip = demoAgents.filter(
    (a) => a.scoreHistory[a.scoreHistory.length - 1] >= a.threshold,
  ).length;
  const best = Math.max(...scores);
  const bestAgent = demoAgents[scores.indexOf(best)];
  const openCritical = demoAgents.reduce((sum, a) => sum + a.lastRun.critical, 0);
  const stats: { label: string; value: string; href: string; tone?: "accent" | "fail" }[] = [
    { label: "Agents under test", value: String(demoAgents.length), href: "/agents" },
    {
      label: "Ready to ship",
      value: `${readyToShip}/${demoAgents.length}`,
      href: "/agents",
      tone: "accent",
    },
    { label: "Best readiness", value: `${best}%`, href: `/agents/${bestAgent.id}` },
    {
      label: "Open critical fails",
      value: String(openCritical),
      href: "/failures?severity=critical",
      tone: openCritical > 0 ? "fail" : undefined,
    },
  ];
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <Link key={s.label} href={s.href} className="focus-ring block rounded-xl">
          <Card className="animate-fade-up p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-mut">
            <div className="eyebrow">{s.label}</div>
            <div
              className={`numeral mt-1 text-3xl ${
                s.tone === "accent" ? "text-accent" : s.tone === "fail" ? "text-fail" : "text-ink"
              }`}
            >
              {s.value}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
