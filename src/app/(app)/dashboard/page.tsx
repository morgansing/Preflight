"use client";

import Link from "next/link";
import { LiveDashboard } from "@/components/live-dashboard";
import { ReadinessCard } from "@/components/readiness-card";
import { Sparkline } from "@/components/sparkline";
import { ButtonLink, Eyebrow } from "@/components/ui";
import styles from "@/components/dashboard.module.css";
import { demoAgents } from "@/lib/fixtures/agents";
import { readiness } from "@/lib/fixtures/run";
import { failingReplayId } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";

/** Weakness → its failing replay, so the readiness card clicks through. */
const weaknessHrefs = Object.fromEntries(
  readiness.weaknesses.map((weakness) => {
    const id = failingReplayId(weakness);
    return [weakness, id && `/replay/${id}`];
  }),
);

export default function DashboardPage() {
  const { mode } = useMode();

  return (
    <div className={styles.dashboard}>
      <div className={styles.ambient} aria-hidden>
        <span className={styles.grid} />
        <span className={styles.glow} />
        <span className={styles.signalLine} />
      </div>

      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.heroEyebrow}>
              <span aria-hidden />
              Dashboard / {mode === "live" ? "live workspace" : "demo workspace"}
            </div>
            <h1>
              Readiness, <em>at a glance.</em>
            </h1>
            <p>
              Agents under test, their latest evidence, and how close each is
              to the deployment threshold.
            </p>
          </div>

          <div className={styles.heroActions}>
            <div className={styles.workspaceStatus}>
              <span className={styles.liveDot} aria-hidden />
              <span>
                <strong>{mode === "live" ? "Live data" : "Verified demo"}</strong>
                {mode === "live" ? "Workspace telemetry" : "200-scenario baseline"}
              </span>
            </div>
            <ButtonLink href="/runs" className={styles.newRunButton}>
              New run <span aria-hidden>→</span>
            </ButtonLink>
          </div>
        </header>

        {mode === "live" ? (
          <LiveDashboard />
        ) : (
          <DemoDashboard />
        )}
      </div>
    </div>
  );
}

function DemoDashboard() {
  return (
    <>
      <DemoStats />

      <section className={styles.contentSection}>
        <div className={styles.sectionHeader}>
          <div>
            <Eyebrow>Fleet readiness</Eyebrow>
            <h2>Latest evidence by agent</h2>
            <p>Every score opens into the agent, run history, and failed decisions behind it.</p>
          </div>
          <Link href="/agents" className={styles.textLink}>
            View all agents <span aria-hidden>→</span>
          </Link>
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.agentList}>
            {demoAgents.map((agent, index) => {
              const score = agent.scoreHistory[agent.scoreHistory.length - 1];
              const above = score >= agent.threshold;
              const progress = (agent.lastRun.passed / agent.lastRun.total) * 100;

              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className={`focus-ring ${styles.agentLink}`}
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <article className={styles.agentCard}>
                    <div className={styles.agentMain}>
                      <div className={styles.agentIdentity}>
                        <span
                          aria-hidden
                          className={`${styles.statusDot} ${above ? styles.passDot : styles.failDot}`}
                        />
                        <div className={styles.agentName}>
                          <strong>{agent.name}</strong>
                          <span>{agent.version}</span>
                        </div>
                      </div>

                      <div className={styles.agentMeta}>
                        <span>{agent.connection}</span>
                        <span>{agent.lastRun.agoLabel}</span>
                      </div>

                      {agent.note && <p className={styles.agentNote}>{agent.note}</p>}
                    </div>

                    <div className={styles.agentScore}>
                      <Sparkline
                        values={agent.scoreHistory}
                        threshold={agent.threshold}
                        width={112}
                        height={32}
                      />
                      <div>
                        <span className={styles.scoreNumber}>{score}</span>
                        <span className={styles.scoreUnit}>%</span>
                      </div>
                      <small>{above ? "Clears gate" : `${agent.threshold - score} pts to gate`}</small>
                    </div>

                    <div className={styles.runEvidence}>
                      <div className={styles.runEvidenceTop}>
                        <span>
                          Run {agent.lastRun.runId.replace("run_", "")} · {agent.lastRun.passed}/
                          {agent.lastRun.total} passed
                        </span>
                        <span className={agent.lastRun.critical > 0 ? styles.critical : styles.clear}>
                          {agent.lastRun.critical} critical
                        </span>
                      </div>
                      <div className={styles.progressTrack} aria-hidden>
                        <span style={{ width: `${progress}%` }} />
                        <i style={{ left: `${agent.threshold}%` }} />
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}

            <div className={styles.thresholdKey}>
              <span><i aria-hidden /> Latest pass rate</span>
              <span><i aria-hidden /> Deployment threshold · 90%</span>
            </div>
          </div>

          <aside className={styles.readinessColumn}>
            <ReadinessCard
              score={readiness.score}
              strengths={readiness.strengths}
              weaknesses={readiness.weaknesses}
              meta={readiness.meta}
              hrefs={weaknessHrefs}
              reportHref="/reports"
              className={styles.readinessCard}
            />
          </aside>
        </div>
      </section>
    </>
  );
}

/** A compact metrics strip above the demo agent list — every tile opens
 * the view behind its number. */
function DemoStats() {
  const scores = demoAgents.map((agent) => agent.scoreHistory[agent.scoreHistory.length - 1]);
  const readyToShip = demoAgents.filter(
    (agent) => agent.scoreHistory[agent.scoreHistory.length - 1] >= agent.threshold,
  ).length;
  const best = Math.max(...scores);
  const bestAgent = demoAgents[scores.indexOf(best)];
  const openCritical = demoAgents.reduce((sum, agent) => sum + agent.lastRun.critical, 0);
  const stats: Array<{
    label: string;
    value: string;
    detail: string;
    href: string;
    tone?: "accent" | "fail";
  }> = [
    {
      label: "Agents under test",
      value: String(demoAgents.length),
      detail: "Registered versions",
      href: "/agents",
    },
    {
      label: "Ready to ship",
      value: `${readyToShip}/${demoAgents.length}`,
      detail: "Above deployment gate",
      href: "/agents",
      tone: "accent",
    },
    {
      label: "Best readiness",
      value: `${best}%`,
      detail: `${bestAgent.name} ${bestAgent.version}`,
      href: `/agents/${bestAgent.id}`,
      tone: "accent",
    },
    {
      label: "Open critical fails",
      value: String(openCritical),
      detail: "Across latest runs",
      href: "/failures?severity=critical",
      tone: openCritical > 0 ? "fail" : undefined,
    },
  ];

  return (
    <section className={styles.metrics} aria-label="Workspace summary">
      <div className={styles.metricsHeader}>
        <span>Current signal</span>
        <span>Latest completed runs</span>
      </div>
      <div className={styles.metricGrid}>
        {stats.map((stat, index) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`focus-ring ${styles.metricLink}`}
            style={{ animationDelay: `${80 + index * 55}ms` }}
          >
            <span className={styles.metricIndex}>0{index + 1}</span>
            <span className={styles.metricLabel}>{stat.label}</span>
            <strong
              className={`${styles.metricValue} ${
                stat.tone === "accent"
                  ? styles.accentValue
                  : stat.tone === "fail"
                    ? styles.failValue
                    : ""
              }`}
            >
              {stat.value}
            </strong>
            <small>{stat.detail}</small>
            <span className={styles.metricArrow} aria-hidden>↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
