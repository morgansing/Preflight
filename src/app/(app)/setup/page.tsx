"use client";

import { SetupWizard } from "@/components/setup-wizard";
import styles from "./setup-page.module.css";

export default function SetupPage() {
  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.kicker}>
              <span aria-hidden="true" />
              Rulebook setup / guided workflow
            </div>
            <h1>
              Teach Preflight <em>your agent.</em>
            </h1>
            <p>
              Five short steps turn agent context, tools, and policy into the
              testable rules behind a custom scenario suite. Every step has a
              light path; more context simply makes the tests sharper.
            </p>
          </div>

          <div
            className={styles.handoff}
            role="group"
            aria-label="Setup input and output"
          >
            <div className={styles.handoffNode}>
              <span>Input</span>
              <strong>Agent + policy</strong>
              <small>Behaviour, tools, constraints</small>
            </div>
            <span className={styles.handoffArrow} aria-hidden="true">
              →
            </span>
            <div className={styles.handoffNode}>
              <span>Output</span>
              <strong>Approved Rulebook</strong>
              <small>Rules ready for scenario generation</small>
            </div>
          </div>
        </header>

        <section
          className={styles.workflow}
          aria-labelledby="setup-workflow-title"
        >
          <div className={styles.workflowHeader}>
            <div>
              <span>Guided setup</span>
              <h2 id="setup-workflow-title">Build the Rulebook</h2>
            </div>
            <div
              className={styles.workflowMeta}
              role="group"
              aria-label="Workflow summary"
            >
              <span>
                <i aria-hidden="true" /> 5 steps
              </span>
              <span>Human-approved output</span>
            </div>
          </div>
          <SetupWizard framed />
        </section>
      </div>
    </div>
  );
}
