"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./activation-checklist.module.css";
import { Eyebrow } from "./ui";
import { useLiveAgents } from "@/lib/live";
import type { LiveRunListItem } from "@/lib/live-types";

/**
 * First-run activation checklist — the five steps from empty workspace
 * to a real evaluation, each checked off by actual state, never by
 * clicking. Disappears once everything is done.
 */

type StepStatus = "complete" | "incomplete" | "unknown";
type CheckStatus = "loading" | "ready" | "error";

type RemoteCheck<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error" };

interface Step {
  label: string;
  detail: string;
  href: string;
  status: StepStatus;
  checkStatus?: CheckStatus;
}

interface SetupResponse {
  rules?: unknown[];
}

interface SuiteResponse {
  suite?: {
    status?: string;
  };
}

function remoteStepStatus<T>(check: RemoteCheck<T>, isComplete: (value: T) => boolean): StepStatus {
  if (check.status !== "ready") return "unknown";
  return isComplete(check.value) ? "complete" : "incomplete";
}

/**
 * Activation is sequential: an unknown earlier check must not promote a
 * later action as the next step. This prevents a false call to action while
 * policy or suite state is still being verified.
 */
function firstActionableStep(steps: Step[]) {
  for (let index = 0; index < steps.length; index += 1) {
    if (steps[index].status === "unknown") return -1;
    if (steps[index].status === "incomplete") return index;
  }
  return -1;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m3.25 8.35 2.7 2.7 6.8-6.8" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}

export function ActivationChecklist({ runs }: { runs: LiveRunListItem[] }) {
  const { agents } = useLiveAgents();
  const [rulesCheck, setRulesCheck] = useState<RemoteCheck<number>>({ status: "loading" });
  const [suiteCheck, setSuiteCheck] = useState<RemoteCheck<boolean>>({ status: "loading" });

  useEffect(() => {
    let alive = true;

    void fetch("/api/setup")
      .then((response) => {
        if (!response.ok) throw new Error("Setup status unavailable");
        return response.json() as Promise<SetupResponse>;
      })
      .then((data) => {
        if (alive) {
          setRulesCheck({
            status: "ready",
            value: Array.isArray(data.rules) ? data.rules.length : 0,
          });
        }
      })
      .catch(() => {
        if (alive) setRulesCheck({ status: "error" });
      });

    void fetch("/api/generate")
      .then((response) => {
        if (!response.ok) throw new Error("Suite status unavailable");
        return response.json() as Promise<SuiteResponse>;
      })
      .then((data) => {
        if (alive) {
          setSuiteCheck({ status: "ready", value: data.suite?.status === "ready" });
        }
      })
      .catch(() => {
        if (alive) setSuiteCheck({ status: "error" });
      });

    return () => {
      alive = false;
    };
  }, []);

  const ownAgent = agents.some(
    (agent) => agent.kind === "http" || agent.kind === "openai",
  );
  const anyRun = runs.length > 0;
  const realRun = runs.some(
    (run) =>
      run.status === "complete" &&
      run.provider !== "mock" &&
      (run.agentKind === "http" || run.agentKind === "openai"),
  );

  const steps: Step[] = [
    {
      label: "Run a sandbox test",
      detail: "Free, offline, zero setup",
      href: "/runs",
      status: anyRun ? "complete" : "incomplete",
    },
    {
      label: "Connect your own agent",
      detail: "HTTP or OpenAI-compatible endpoint",
      href: "/agents/connect",
      status: ownAgent ? "complete" : "incomplete",
    },
    {
      label: "Teach Preflight your policy",
      detail: "Docs, prompt, conversations, or seven questions",
      href: "/setup",
      status: remoteStepStatus(rulesCheck, (count) => count > 0),
      checkStatus: rulesCheck.status,
    },
    {
      label: "Generate your Rulebook suite",
      detail: "Scenarios written for your rules",
      href: "/setup",
      status: remoteStepStatus(suiteCheck, Boolean),
      checkStatus: suiteCheck.status,
    },
    {
      label: "Run your agent for real",
      detail: "The score that means something",
      href: "/runs",
      status: realRun ? "complete" : "incomplete",
    },
  ];

  const completeCount = steps.filter((step) => step.status === "complete").length;
  const nextStepIndex = firstActionableStep(steps);
  const verificationInFlight = steps.some((step) => step.checkStatus === "loading");
  const verificationUnavailable = steps.some((step) => step.checkStatus === "error");

  if (completeCount === steps.length) return null;

  const summary = nextStepIndex >= 0
    ? "Your next action is marked below. Everything after it stays in sequence."
    : verificationInFlight
      ? "Checking your policy and generated suite before choosing the next action."
      : verificationUnavailable
        ? "Some setup status could not be verified. Open Setup to review it."
        : "Your activation path is up to date.";

  return (
    <section
      className={styles.checklist}
      aria-labelledby="activation-checklist-title"
      aria-busy={verificationInFlight}
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <div id="activation-checklist-title">
            <Eyebrow>Getting to a real evaluation</Eyebrow>
          </div>
          <p aria-live="polite">{summary}</p>
        </div>
        <div
          className={styles.progress}
          aria-label={`${completeCount} of ${steps.length} activation steps complete`}
        >
          <strong>{completeCount}</strong>
          <span>/{steps.length}</span>
        </div>
      </div>

      <ol className={styles.steps}>
        {steps.map((step, index) => {
          const isNext = index === nextStepIndex;
          const isComplete = step.status === "complete";
          const isUnknown = step.status === "unknown";
          const stateClass = isNext
            ? styles.stepNext
            : isComplete
              ? styles.stepComplete
              : isUnknown
                ? styles.stepUnknown
                : styles.stepQuiet;

          return (
            <li key={step.label} className={`${styles.step} ${stateClass}`}>
              <Link
                href={step.href}
                className={`focus-ring ${styles.stepLink}`}
                aria-current={isNext ? "step" : undefined}
              >
                <span className={styles.stepTop}>
                  <span className={styles.marker} aria-hidden="true">
                    {isComplete ? <CheckIcon /> : index + 1}
                  </span>
                  <span className={styles.label}>
                    <span className="sr-only">
                      {isComplete ? "Complete: " : isNext ? "Next: " : ""}
                    </span>
                    {step.label}
                  </span>
                  {isNext && <span className={styles.nextBadge}>Next</span>}
                </span>

                <span className={styles.detail}>{step.detail}</span>

                {isUnknown && (
                  <span className={styles.checkBadge}>
                    {step.checkStatus === "loading" ? "Checking" : "Unavailable"}
                  </span>
                )}

                {isNext && (
                  <span className={styles.primaryAction}>
                    Continue
                    <ArrowIcon />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
