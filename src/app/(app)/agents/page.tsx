"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { Sparkline } from "@/components/sparkline";
import { demoAgents } from "@/lib/fixtures/agents";
import { useLiveAgents, type ConnectionKind } from "@/lib/live";
import { useMode } from "@/lib/mode";
import { verdictFor } from "@/lib/types";
import styles from "./agents.module.css";

const kindLabels: Record<ConnectionKind, string> = {
  openai: "OpenAI-compatible endpoint",
  http: "HTTP endpoint",
  mcp: "MCP endpoint",
  reference: "Reference agent",
};

export default function AgentsPage() {
  const { mode } = useMode();
  const live = useLiveAgents();
  const readyAgents = demoAgents.filter(
    (agent) => agent.scoreHistory.at(-1)! >= agent.threshold,
  ).length;
  const scenarioJudgements = demoAgents.reduce(
    (total, agent) => total + agent.lastRun.total,
    0,
  );
  const runnableRegistrations = live.agents.filter((agent) => agent.kind !== "mcp").length;
  const mcpRegistrations = live.agents.filter((agent) => agent.kind === "mcp").length;

  return (
    <div className={styles.journey}>
      <div className={styles.ambient} aria-hidden />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.heroEyebrow}>
              <span /> Agent inventory / {mode} workspace
            </div>
            <h1>
              Agents, <em>under evidence.</em>
            </h1>
            <p>
              {mode === "demo"
                ? "Track every agent version against its deployment bar, latest scenario coverage, and the failures that still need attention."
                : "Manage the agents registered for live runs against the simulated store, with transport status kept visible before the first evaluation."}
            </p>
          </div>
          <div className={styles.heroActions}>
            <div className={styles.workspaceStatus}>
              <span className={styles.workspaceDot} aria-hidden />
              <span>
                <strong>{mode === "demo" ? "Demo evidence loaded" : "Live registry"}</strong>
                {mode === "demo"
                  ? `${demoAgents.length} agent versions`
                  : `${live.agents.length} saved registration${live.agents.length === 1 ? "" : "s"}`}
              </span>
            </div>
            <ButtonLink href="/agents/connect" className={styles.primaryAction}>
              Connect an agent
            </ButtonLink>
          </div>
        </header>

        <section className={styles.summary} aria-label="Agent inventory summary">
          <div className={styles.summaryCell}>
            <div className={styles.microLabel}>Registered</div>
            <div className={styles.summaryValue}>
              {mode === "demo" ? demoAgents.length : live.agents.length}
              <em>{mode === "demo" ? "versions" : "agents"}</em>
            </div>
            <p>
              {mode === "demo"
                ? "Versions currently represented in the demo workspace."
                : "Connections saved in this browser for live mode."}
            </p>
          </div>
          <div className={styles.summaryCell}>
            <div className={styles.microLabel}>
              {mode === "demo" ? "Ready to ship" : "Run support"}
            </div>
            <div className={styles.summaryValue}>
              {mode === "demo" ? readyAgents : runnableRegistrations}
              <em>{mode === "demo" ? `of ${demoAgents.length}` : "eligible"}</em>
            </div>
            <p>
              {mode === "demo"
                ? "Latest scores that clear each agent's deployment threshold."
                : "OpenAI-compatible, HTTP, and reference registrations can enter the current harness."}
            </p>
          </div>
          <div className={styles.summaryCell}>
            <div className={styles.microLabel}>
              {mode === "demo" ? "Latest coverage" : "MCP registrations"}
            </div>
            <div className={styles.summaryValue}>
              {mode === "demo" ? scenarioJudgements : mcpRegistrations}
              <em>{mode === "demo" ? "judgements" : "saved"}</em>
            </div>
            <p>
              {mode === "demo"
                ? "Scenario outcomes across the latest run for every version."
                : "Saved to the inventory while MCP execution remains an upcoming milestone."}
            </p>
          </div>
        </section>

        <section className={styles.fleetSection} aria-labelledby="agent-fleet-title">
          <div className={styles.sectionHeader}>
            <div>
              <div className={styles.sectionEyebrow}>Evaluation fleet</div>
              <h2 id="agent-fleet-title">
                {mode === "demo" ? "Version readiness" : "Registered connections"}
              </h2>
            </div>
            <span>
              {mode === "demo"
                ? `${demoAgents.length} versions / ${scenarioJudgements} scenario judgements`
                : `${live.agents.length} registration${live.agents.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {mode === "demo" ? (
            <div className={styles.agentList}>
              {demoAgents.map((agent) => {
                const score = agent.scoreHistory.at(-1)!;
                const ready = score >= agent.threshold;
                const coverage = (agent.lastRun.passed / agent.lastRun.total) * 100;
                return (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className={`${styles.agentLink} focus-ring`}
                  >
                    <article className={styles.agentCard}>
                      <div className={styles.agentMain}>
                        <div className={styles.agentStatus} data-ready={ready}>
                          <span className={styles.agentDot} aria-hidden />
                          {ready ? "Clears deployment bar" : "Below deployment bar"}
                        </div>
                        <div className={styles.agentTitle}>
                          <h3>{agent.name}</h3>
                          <span>{agent.version}</span>
                        </div>
                        <div className={styles.agentMeta}>
                          <span>{agent.connection}</span>
                          <span>threshold {agent.threshold}%</span>
                          <span>last run {agent.lastRun.agoLabel}</span>
                        </div>
                        {agent.note && <p className={styles.agentNote}>{agent.note}</p>}
                      </div>

                      <div className={styles.agentScore}>
                        <Sparkline values={agent.scoreHistory} threshold={agent.threshold} />
                        <div className={styles.scoreNumber}>
                          {score}<span>%</span>
                        </div>
                        <div className={styles.scoreVerdict} data-ready={ready}>
                          {verdictFor(score)}
                        </div>
                      </div>

                      <div className={styles.evidenceBand}>
                        <div className={styles.evidenceTop}>
                          <span>
                            <strong>{agent.lastRun.passed}</strong> / {agent.lastRun.total} scenarios passed
                          </span>
                          <span className={styles.critical}>
                            {agent.lastRun.critical} critical failures
                          </span>
                        </div>
                        <div
                          className={styles.coverageTrack}
                          role="progressbar"
                          aria-label={`${agent.name} ${agent.version} latest scenario pass rate`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(coverage)}
                        >
                          <span className={styles.coverageFill} style={{ width: `${coverage}%` }} />
                          <i
                            className={styles.thresholdMarker}
                            style={{ left: `${agent.threshold}%` }}
                            aria-hidden
                          />
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          ) : live.agents.length === 0 ? (
            <div className={styles.emptyPanel}>
              <div className={styles.emptyContent}>
                <div className={styles.emptyIcon} aria-hidden>
                  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25">
                    <rect x="5" y="9" width="22" height="16" rx="3" />
                    <path d="M16 9V5M11 17h.01M21 17h.01M12 21h8" strokeLinecap="round" />
                  </svg>
                </div>
                <h2>Connect your first agent to see how it holds up.</h2>
                <p>
                  Register an HTTP or MCP endpoint, or use the built-in reference agent.
                  Live runs work out of the box with no external agent.
                </p>
                <ButtonLink href="/agents/connect">Connect an agent</ButtonLink>
              </div>
            </div>
          ) : (
            <div className={styles.agentList}>
              {live.agents.map((agent) => (
                <article key={agent.id} className={`${styles.agentCard} ${styles.liveCard}`}>
                  <div className={styles.agentMain}>
                    <div className={styles.agentStatus}>
                      <span className={styles.agentDot} aria-hidden /> Registered
                    </div>
                    <div className={styles.agentTitle}>
                      <h3>{agent.name}</h3>
                    </div>
                    <div className={styles.agentMeta}>
                      <span>{kindLabels[agent.kind]}</span>
                      {agent.model && <span>{agent.model}</span>}
                    </div>
                    {agent.endpoint && (
                      <p className={`${styles.agentNote} ${styles.liveEndpoint}`} title={agent.endpoint}>
                        {agent.endpoint}
                      </p>
                    )}
                  </div>

                  <div className={styles.awaitingScore} aria-label="No score yet">
                    —
                  </div>

                  <div className={styles.evidenceBand}>
                    <div className={styles.evidenceTop}>
                      <span><strong>No runs yet</strong></span>
                      <span>
                        {agent.kind === "mcp"
                          ? "Execution support upcoming"
                          : agent.kind === "reference"
                            ? "Ready for a live run"
                            : "Provider configuration required"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
