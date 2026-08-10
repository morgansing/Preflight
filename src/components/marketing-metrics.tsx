"use client";

import { motion, type Variants } from "framer-motion";
import { demoRun, runStats } from "@/lib/fixtures/run";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import styles from "./marketing-metrics.module.css";

const OUTCOMES = [
  {
    count: runStats.pass.toLocaleString(),
    label: "Handled correctly",
    detail: "Passed the expected path",
    glyph: "✓",
    tone: "pass",
  },
  {
    count: runStats.fail.toLocaleString(),
    label: "Customer impact",
    detail: "Would have reached customers",
    glyph: "×",
    tone: "fail",
  },
  {
    count: runStats.partial.toLocaleString(),
    label: "Off-policy",
    detail: "Resolved outside policy",
    glyph: "◐",
    tone: "partial",
  },
] as const;

const WALL_CELLS = demoRun.cells.map((cell) => ({
  id: cell.scenarioId,
  tone: cell.outcome,
}));

const consoleVariants: Variants = {
  hidden: { opacity: 0.45, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.62,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.46, ease: [0.16, 1, 0.3, 1] },
  },
};

export function MarketingMetrics() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.32 }}
      variants={consoleVariants}
      className={styles.console}
      aria-label={`Completed Preflight run: ${runStats.pass} of ${runStats.total} scenarios passed, ${runStats.fail} failures would have reached customers, and ${runStats.partial} scenarios resolved off-policy.`}
    >
      <header className={styles.header}>
        <div className={styles.runIdentity}>
          <span className={styles.statusDot} aria-hidden />
          <div>
            <span>RUN run_0147</span>
            <strong>
              Aurora Support v1.3 <em>· Ecommerce Support Suite v2</em>
            </strong>
          </div>
        </div>
        <span className={styles.complete}>COMPLETE</span>
      </header>

      <motion.div className={styles.statsBar} variants={itemVariants}>
        <span>
          <small>PASS RATE</small>
          <strong className={styles.accent}>{runStats.score}%</strong>
        </span>
        <span>
          <small>COMPLETE</small>
          <strong>{runStats.total} / {runStats.total}</strong>
        </span>
        <span>
          <small>ELAPSED</small>
          <strong>00:{String(Math.round(demoRun.durationMs / 1000)).padStart(2, "0")}</strong>
        </span>
        <span>
          <small>COST</small>
          <strong>${runStats.costUsd.toFixed(2)}</strong>
        </span>
      </motion.div>

      <div className={styles.body}>
        <motion.aside className={styles.readout} variants={itemVariants}>
          <div className={styles.readoutHead}>
            <span>RUN RESULT</span>
            <div>
              <strong>{runStats.pass}</strong>
              <small>/ {runStats.total}</small>
            </div>
            <p>scenarios handled correctly</p>
          </div>

          <div className={styles.outcomes}>
            {OUTCOMES.map((outcome) => (
              <motion.div
                key={outcome.label}
                className={`${styles.outcome} ${styles[outcome.tone]}`}
                variants={itemVariants}
              >
                <span className={styles.outcomeGlyph} aria-hidden>
                  {outcome.glyph}
                </span>
                <span className={styles.outcomeCopy}>
                  <b>{outcome.label}</b>
                  <small>{outcome.detail}</small>
                </span>
                <strong>{outcome.count}</strong>
              </motion.div>
            ))}
          </div>
        </motion.aside>

        <motion.div className={styles.wallPanel} variants={itemVariants}>
          <div className={styles.wallHeader}>
            <span>THE WALL</span>
            <span>{runStats.total} SCENARIOS · OUTCOME MAP</span>
          </div>

          <div className={styles.wall} aria-hidden>
            {WALL_CELLS.map((cell) => (
              <span
                key={cell.id}
                className={`${styles.wallCell} ${styles[cell.tone]}`}
                title={`${cell.id} · ${cell.tone}`}
              >
                {cell.tone === "pass" ? "✓" : cell.tone === "fail" ? "×" : "◐"}
              </span>
            ))}
          </div>

          <div className={styles.wallFooter}>
            <span className={styles.legend}>
              <i className={styles.pass} aria-hidden />
              PASS {runStats.pass}
            </span>
            <span className={styles.legend}>
              <i className={styles.fail} aria-hidden />
              FAIL {runStats.fail}
            </span>
            <span className={styles.legend}>
              <i className={styles.partial} aria-hidden />
              PARTIAL {runStats.partial}
            </span>
          </div>

          <div className={styles.completion}>
            <motion.span
              aria-hidden
              initial={reduceMotion ? false : { scaleX: 0 }}
              whileInView={reduceMotion ? undefined : { scaleX: 1 }}
              viewport={{ once: true, amount: 0.65 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
            <small>RUN COMPLETE · FULL EVIDENCE AVAILABLE IN THE RUN WALL</small>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
