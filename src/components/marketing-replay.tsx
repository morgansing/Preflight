"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Replay, ReplayStep, Scenario } from "@/lib/types";
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
  divergence,
}: {
  step: ReplayStep;
  active: boolean;
  divergence: boolean;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: active ? 1 : 0.58, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={`${styles.stepCard} ${active ? styles.stepActive : ""} ${
        divergence ? styles.stepDivergence : ""
      }`}
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
  const reduceMotion = useReducedMotion();
  const last = replay.steps.length - 1;
  const [current, setCurrent] = useState(reduceMotion ? last : 0);
  const [playing, setPlaying] = useState(!reduceMotion);

  useEffect(() => {
    if (!playing || !inView || reduceMotion) return;
    const id = window.setInterval(() => {
      setCurrent((step) => (step >= last ? 0 : step + 1));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [inView, last, playing, reduceMotion]);

  const visibleSteps = useMemo(
    () => replay.steps.slice(Math.max(0, current - 3), current + 1),
    [current, replay.steps],
  );
  const seen = useMemo(
    () =>
      replay.steps
        .map((step, index) => ({ step, index }))
        .filter(
          ({ step, index }) =>
            index <= current &&
            (step.actor === "customer" || step.kind === "tool_result"),
        )
        .slice(-2),
    [current, replay.steps],
  );

  const hasDiverged =
    replay.divergenceStep !== undefined && current >= replay.divergenceStep;
  const completed = current === last;

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

      <div className={styles.columns}>
        <section className={styles.column} aria-label="What the agent saw">
          <div className={styles.columnLabel}>WHAT THE AGENT SAW</div>
          <div className={styles.stack}>
            <AnimatePresence initial={false} mode="popLayout">
              {seen.map(({ step, index }) => (
                <StepCard
                  key={`seen-${index}`}
                  step={step}
                  active={index === current}
                  divergence={false}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>

        <section
          className={`${styles.column} ${styles.activityColumn}`}
          aria-label="What the agent did"
          aria-live="polite"
        >
          <div className={styles.columnLabel}>WHAT THE AGENT DID</div>
          <div className={styles.stack}>
            <AnimatePresence initial={false} mode="popLayout">
              {visibleSteps.map((step, offset) => {
                const index = Math.max(0, current - 3) + offset;
                return (
                  <StepCard
                    key={`action-${index}`}
                    step={step}
                    active={index === current}
                    divergence={index === replay.divergenceStep}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </section>

        <section className={styles.column} aria-label="Expected path">
          <div className={styles.columnLabel}>EXPECTED PATH</div>
          <p className={styles.rubric}>{scenario.rubric}</p>
          <div className={styles.pathStack}>
            {replay.expectedPath.map((expected, index) => {
              const violated =
                hasDiverged && index === replay.divergenceExpected;
              const met =
                completed && expected.kind === "must" && !violated;
              return (
                <motion.div
                  key={`${expected.kind}-${expected.text}`}
                  animate={
                    violated
                      ? {
                          borderColor: "rgba(240, 84, 79, 0.64)",
                          backgroundColor: "rgba(240, 84, 79, 0.09)",
                          x: [0, -2, 2, 0],
                        }
                      : undefined
                  }
                  transition={{ duration: 0.55 }}
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
                    {violated && (
                      <span className={styles.violatedAt}>
                        ✕ violated at step{" "}
                        {String((replay.divergenceStep ?? 0) + 1).padStart(2, "0")}
                      </span>
                    )}
                    {met && <span className={styles.metAt}>✓ criterion met</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>

      <footer className={styles.controls}>
        <button
          type="button"
          className={styles.playButton}
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <div className={styles.scrubber} aria-label={`Replay step ${current + 1} of ${last + 1}`}>
          {replay.steps.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`${styles.scrubStep} ${
                index <= current ? styles.scrubStepComplete : ""
              } ${index === replay.divergenceStep && hasDiverged ? styles.scrubFail : ""}`}
              onClick={() => {
                setCurrent(index);
                setPlaying(false);
              }}
              aria-label={`Go to replay step ${index + 1}`}
            />
          ))}
        </div>
        <span className={styles.stepCount}>
          {String(current + 1).padStart(2, "0")} / {String(last + 1).padStart(2, "0")}
        </span>
      </footer>
    </div>
  );
}
