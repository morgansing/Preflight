"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Replay, ReplayStep, Scenario } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import styles from "./marketing-replay.module.css";

const STEP_MS = 1700;

type ReplayScenario = Pick<
  Scenario,
  "id" | "name" | "rubric" | "severity" | "category"
>;

function stepLabel(step: ReplayStep) {
  if (step.kind === "tool_call") return `AGENT · CALL ${step.label ?? "TOOL"}`;
  if (step.kind === "tool_result") return `STORE · ${step.label ?? "TOOL"} RESULT`;
  if (step.kind === "reasoning") return "AGENT · REASONING";
  return step.actor === "customer" ? "CUSTOMER" : "AGENT · REPLY";
}

function StepCard({
  step,
  active,
  revealed,
  divergence,
  reducedMotion,
}: {
  step: ReplayStep;
  active: boolean;
  revealed: boolean;
  divergence: boolean;
  reducedMotion: boolean;
}) {
  return (
    <motion.article
      initial={false}
      animate={{
        opacity: revealed ? (active ? 1 : 0.58) : 0,
        y: revealed ? 0 : 10,
      }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              duration: 0.58,
              ease: [0.16, 1, 0.3, 1],
              opacity: { duration: 0.46, ease: "easeOut" },
            }
      }
      aria-hidden={!revealed}
      data-replay-active={active ? "true" : "false"}
      data-replay-revealed={revealed ? "true" : "false"}
      className={`${styles.stepCard} ${active ? styles.stepActive : ""} ${
        divergence ? styles.stepDivergence : ""
      } ${!revealed ? styles.stepPending : ""}`}
    >
      {divergence && <span className={styles.divergenceFlag}>DIVERGENCE</span>}
      <div className={styles.stepLabel}>{stepLabel(step)}</div>
      <div
        className={`${styles.stepContent} ${
          step.kind === "reasoning" ? styles.reasoning : ""
        }`}
      >
        {step.content}
      </div>
    </motion.article>
  );
}

export function MarketingReplay({
  replay,
  scenario,
}: {
  replay: Replay;
  scenario: ReplayScenario;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.22 });
  const reduceMotion = usePrefersReducedMotion();
  const seenStackRef = useRef<HTMLDivElement>(null);
  const actionStackRef = useRef<HTMLDivElement>(null);
  const last = replay.steps.length - 1;
  // Always start from the first step so SSR and the first client paint match.
  // Reduced-motion users see the final step via derived state (no sync effect).
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const activeIndex = reduceMotion ? last : current;
  const isPlaying = !reduceMotion && playing;

  useEffect(() => {
    if (!isPlaying || !inView) return;
    const id = window.setInterval(() => {
      setCurrent((value) => (value >= last ? 0 : value + 1));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [inView, isPlaying, last]);

  const seenSteps = useMemo(
    () =>
      replay.steps
        .map((step, index) => ({ step, index }))
        .filter(
          ({ step }) =>
            step.actor === "customer" || step.kind === "tool_result",
        ),
    [replay.steps],
  );

  const hasDiverged =
    replay.divergenceStep !== undefined &&
    activeIndex >= replay.divergenceStep;
  const completed = activeIndex === last;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";

      [seenStackRef.current, actionStackRef.current].forEach((stack) => {
        if (!stack) return;

        const active = stack.querySelector<HTMLElement>(
          '[data-replay-active="true"]',
        );
        const revealed = stack.querySelectorAll<HTMLElement>(
          '[data-replay-revealed="true"]',
        );
        const target = active ?? revealed.item(revealed.length - 1);

        if (!target) return;

        const centeredTop =
          target.offsetTop - (stack.clientHeight - target.offsetHeight) / 2;
        stack.scrollTo({
          top: Math.max(0, centeredTop),
          behavior,
        });
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, reduceMotion]);

  return (
    <div ref={rootRef} className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          <span className={styles.wallLabel}>WALL</span>
          <span className={styles.scenarioId}>{scenario.id}</span>
          <h3>{scenario.name}</h3>
          <span className={styles.failChip}>✕ FAIL</span>
          <span className={styles.severity}>{scenario.severity}</span>
        </div>
        <div className={styles.telemetry}>
          ${replay.costUsd.toFixed(3)} · {(replay.latencyMs / 1000).toFixed(1)}s ·{" "}
          {replay.tokens.toLocaleString()} tok
        </div>
      </header>

      <div className={styles.columnsFrame}>
        <div
          className={styles.columnsViewport}
          tabIndex={0}
          aria-label="Replay comparison. Scroll horizontally to compare all three views."
        >
          <div className={styles.columns}>
            <section className={styles.column} aria-label="What the agent saw">
              <div className={styles.columnLabel}>WHAT THE AGENT SAW</div>
              <div ref={seenStackRef} className={styles.stack}>
                {seenSteps.map(({ step, index }) => {
                  const revealed = index <= activeIndex;
                  return (
                    <StepCard
                      key={`seen-${index}`}
                      step={step}
                      active={revealed && index === activeIndex}
                      revealed={revealed}
                      divergence={false}
                      reducedMotion={Boolean(reduceMotion)}
                    />
                  );
                })}
              </div>
            </section>

            <section
              className={`${styles.column} ${styles.activityColumn}`}
              aria-label="What the agent did"
              aria-live="polite"
            >
              <div className={styles.columnLabel}>WHAT THE AGENT DID</div>
              <div ref={actionStackRef} className={styles.stack}>
                {replay.steps.map((step, index) => {
                  const revealed = index <= activeIndex;
                  return (
                    <StepCard
                      key={`action-${index}`}
                      step={step}
                      active={index === activeIndex}
                      revealed={revealed}
                      divergence={
                        revealed && index === replay.divergenceStep
                      }
                      reducedMotion={Boolean(reduceMotion)}
                    />
                  );
                })}
              </div>
            </section>

            <section
              className={`${styles.column} ${styles.expectedColumn}`}
              aria-label="Expected path"
            >
              <div className={styles.columnLabel}>EXPECTED PATH</div>
              <p className={styles.rubric}>{scenario.rubric}</p>
              <div className={styles.pathStack}>
                {replay.expectedPath.map((expected, index) => {
                  const violated =
                    hasDiverged && index === replay.divergenceExpected;
                  const met =
                    completed && expected.kind === "must" && !violated;
                  const status = violated
                    ? `✕ violated at step ${String(
                        (replay.divergenceStep ?? 0) + 1,
                      ).padStart(2, "0")}`
                    : met
                      ? "✓ criterion met"
                      : "";

                  return (
                    <motion.div
                      key={`${expected.kind}-${expected.text}`}
                      initial={false}
                      animate={
                        violated && !reduceMotion
                          ? { x: [0, -1.5, 1.5, 0] }
                          : { x: 0 }
                      }
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { duration: 0.58, ease: [0.16, 1, 0.3, 1] }
                      }
                      className={`${styles.pathCard} ${
                        violated ? styles.pathViolated : ""
                      }`}
                    >
                      <span
                        className={
                          expected.kind === "must_not"
                            ? styles.mustNotGlyph
                            : styles.mustGlyph
                        }
                        aria-hidden
                      >
                        {expected.kind === "must_not" ? "⊘" : "✓"}
                      </span>
                      <div>
                        <div className={styles.pathKind}>
                          {expected.kind === "must_not" ? "MUST NOT" : "MUST"}
                        </div>
                        <p>{expected.text}</p>
                        <span
                          className={`${styles.pathStatus} ${
                            violated
                              ? styles.violatedAt
                              : met
                                ? styles.metAt
                                : ""
                          }`}
                          aria-hidden={!status}
                        >
                          {status || "\u00a0"}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
        <span className={styles.scrollHint} aria-hidden>
          SWIPE TO COMPARE →
        </span>
      </div>

      <footer className={styles.controls}>
        <button
          type="button"
          className={styles.playButton}
          onClick={() => setPlaying((value) => !value)}
          aria-label={isPlaying ? "Pause replay" : "Play replay"}
          disabled={reduceMotion}
        >
          {isPlaying ? "Ⅱ" : "▶"}
        </button>
        <div className={styles.scrubber} aria-label={`Replay step ${activeIndex + 1} of ${last + 1}`}>
          {replay.steps.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`${styles.scrubStep} ${
                index <= activeIndex ? styles.scrubStepComplete : ""
              } ${index === replay.divergenceStep && hasDiverged ? styles.scrubFail : ""}`}
              onClick={() => {
                setCurrent(index);
                setPlaying(false);
              }}
              aria-label={`Go to replay step ${index + 1}`}
              disabled={reduceMotion}
            />
          ))}
        </div>
        <span className={styles.stepCount}>
          {String(activeIndex + 1).padStart(2, "0")} / {String(last + 1).padStart(2, "0")}
        </span>
      </footer>
    </div>
  );
}
