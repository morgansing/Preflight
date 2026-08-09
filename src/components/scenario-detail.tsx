"use client";

import Link from "next/link";
import { DifficultyLabel, Eyebrow, OutcomeChip, SeverityLabel } from "@/components/ui";
import { demoAgents } from "@/lib/fixtures/agents";
import { latestRunOutcomes } from "@/lib/fixtures/runs";
import type { Scenario } from "@/lib/types";

import styles from "./evidence-browser.module.css";

/** The full scenario definition + how each agent's latest run handled
 * it. Rendered in the library drawer and on the scenario's own page. */
export function ScenarioDetail({
  scenario,
  outcome,
  permalinkHref,
  compact = false,
}: {
  scenario: Scenario;
  /** The demo run's outcome — enables the "last replay" link. */
  outcome?: string;
  /** When set (the drawer), a link to the scenario's own page. */
  permalinkHref?: string;
  /** Drawer presentation collapses the evidence columns. */
  compact?: boolean;
}) {
  return (
    <div className={`${styles.detail} ${compact ? styles.detailCompact : ""}`}>
      <div className={styles.detailMeta}>
        {scenario.id} · {scenario.category}
        <SeverityLabel severity={scenario.severity} />
        <DifficultyLabel level={scenario.difficulty} />
        {outcome && (
          <Link
            href={`/replay/${scenario.id}`}
            className={styles.detailLink}
          >
            last replay →
          </Link>
        )}
        {permalinkHref && (
          <Link
            href={permalinkHref}
            className={styles.detailLink}
          >
            open page →
          </Link>
        )}
      </div>
      <div className={styles.detailGrid}>
        <div className={styles.detailColumn}>
          <Field label="Correct outcome" primary>
            {scenario.rubric}
          </Field>
          <Field label="Customer persona">{scenario.persona}</Field>
          <Field label="Opening message">
            <p className={styles.openingQuote}>“{scenario.openingMessage}”</p>
          </Field>
          <Field label="Hidden facts">
            <ul className={styles.factList}>
              {scenario.hiddenFacts.map((fact) => (
                <li className={styles.factItem} key={fact}>
                  <span aria-hidden>·</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </Field>
        </div>

        <div className={styles.detailColumn}>
          <Field label="Pass criteria">
            <ul className={styles.criteriaList}>
              {scenario.passCriteria.map((criterion) => (
                <li className={styles.criterion} key={criterion}>
                  <span aria-hidden className={styles.criterionMark}>✓</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </Field>
          <Field label="Must not">
            <ul className={styles.criteriaList}>
              {scenario.mustNot.map((criterion) => (
                <li className={styles.criterion} key={criterion}>
                  <span
                    aria-hidden
                    className={`${styles.criterionMark} ${styles.mustNotMark}`}
                  >
                    ⊘
                  </span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </Field>
          {/* Pivot from the test to the agents: how each agent's latest run
              handled this exact scenario. */}
          <Field label="Agents on this scenario">
            <div className={styles.agentList}>
              {demoAgents.map((agent) => {
                const result = latestRunOutcomes(agent.id)?.get(scenario.id);
                return (
                  <Link
                    key={agent.id}
                    href={`/agents/${agent.id}`}
                    className={styles.agentLink}
                  >
                    <span className={styles.agentIdentity}>
                      <span className={styles.agentName}>
                        {agent.name}{" "}
                        <span className={styles.agentVersion}>{agent.version}</span>
                      </span>
                      <span className={styles.agentTime}>
                        last run {agent.lastRun.agoLabel}
                      </span>
                    </span>
                    {result ? (
                      <OutcomeChip outcome={result} />
                    ) : (
                      <span className={styles.agentMissing}>not in last run</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  primary = false,
}: {
  label: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <div className={`${styles.field} ${primary ? styles.fieldPrimary : ""}`}>
      <Eyebrow className={styles.fieldLabel}>{label}</Eyebrow>
      <div className={styles.fieldBody}>{children}</div>
    </div>
  );
}
