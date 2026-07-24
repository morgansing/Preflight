"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import styles from "./marketing-metrics.module.css";

const METRICS = [
  {
    value: "194",
    label: "scenarios handled correctly",
    shortLabel: "CORRECT",
    status: "CLEARED",
    width: 97,
    tone: "safe",
  },
  {
    value: "4",
    label: "would have reached customers",
    shortLabel: "CUSTOMER IMPACT",
    status: "BLOCK",
    width: 2,
    tone: "fail",
  },
  {
    value: "2",
    label: "resolved, but off-policy",
    shortLabel: "OFF-POLICY",
    status: "REVIEW",
    width: 1,
    tone: "warn",
  },
] as const;

const consoleVariants: Variants = {
  hidden: { opacity: 0.45, y: 18, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.72,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.11,
      delayChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: 14 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1] },
  },
};

export function MarketingMetrics() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.38 }}
      variants={consoleVariants}
      className={styles.console}
      aria-label="Preflight launch diagnostic: 194 scenarios handled correctly, 4 would have reached customers, and 2 were resolved off-policy."
    >
      <div className={styles.grid} aria-hidden />
      <motion.div
        className={styles.scanBeam}
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : { x: ["-160%", "620%"], opacity: [0, 0.65, 0.65, 0] }
        }
        transition={{
          duration: 8,
          ease: "linear",
          repeat: Infinity,
          repeatDelay: 1.4,
        }}
      />

      <header className={styles.header}>
        <div className={styles.systemLabel}>
          <motion.i
            aria-hidden
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.45, 1, 0.45], scale: [0.82, 1, 0.82] }
            }
            transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
          />
          PREFLIGHT / LAUNCH DIAGNOSTIC
        </div>
        <div className={styles.runStamp}>
          <span>ONE RUN · THIS MORNING</span>
          <span className={styles.complete}>COMPLETE</span>
        </div>
      </header>

      <div className={styles.body}>
        <motion.div className={styles.dialPanel} variants={itemVariants}>
          <div className={styles.dial}>
            <div className={styles.dialTicks} aria-hidden />
            <motion.div
              className={styles.dialRing}
              aria-hidden
              initial={reduceMotion ? false : { opacity: 0, rotate: -38, scale: 0.9 }}
              whileInView={
                reduceMotion ? undefined : { opacity: 1, rotate: 0, scale: 1 }
              }
              viewport={{ once: true, amount: 0.55 }}
              transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              className={styles.sweep}
              aria-hidden
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 5.8, repeat: Infinity, ease: "linear" }}
            />
            <div className={styles.dialCore}>
              <span className={styles.dialKicker}>CLEARED</span>
              <motion.strong variants={itemVariants}>194</motion.strong>
              <span className={styles.dialTotal}>OF 200 SCENARIOS</span>
            </div>
          </div>

          <div className={styles.verdict}>
            <span>LAUNCH SIGNAL</span>
            <strong>97% correct</strong>
            <p>
              <b>4 block</b>
              <i aria-hidden>·</i>
              <em>2 review</em>
            </p>
          </div>
        </motion.div>

        <div className={styles.readout}>
          <motion.div className={styles.readoutHeader} variants={itemVariants}>
            <span>SCENARIO DISTRIBUTION</span>
            <span>200 / 200 EVALUATED</span>
          </motion.div>

          <motion.div className={styles.distribution} variants={itemVariants}>
            {METRICS.map((metric) => (
              <motion.span
                key={metric.shortLabel}
                className={`${styles.distributionSegment} ${styles[metric.tone]}`}
                style={{ flexGrow: metric.width }}
                variants={{
                  hidden: { scaleX: 0 },
                  visible: {
                    scaleX: 1,
                    transition: {
                      duration: 0.95,
                      ease: [0.16, 1, 0.3, 1],
                    },
                  },
                }}
              />
            ))}
          </motion.div>

          <div className={styles.metrics}>
            {METRICS.map((metric) => (
              <motion.div
                key={metric.label}
                className={`${styles.metricRow} ${styles[metric.tone]}`}
                variants={itemVariants}
              >
                <span className={styles.metricValue}>{metric.value}</span>
                <span className={styles.metricCopy}>
                  <b>{metric.shortLabel}</b>
                  <span>{metric.label}</span>
                </span>
                <span className={styles.metricStatus}>
                  <i aria-hidden />
                  {metric.status}
                </span>
                <motion.span
                  className={styles.metricTrace}
                  aria-hidden
                  variants={{
                    hidden: { scaleX: 0, opacity: 0 },
                    visible: {
                      scaleX: 1,
                      opacity: 1,
                      transition: {
                        duration: 0.82,
                        ease: [0.16, 1, 0.3, 1],
                      },
                    },
                  }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <span>TOOL PATHS / POLICY / JUDGEMENT</span>
        <motion.span
          className={styles.blockerSignal}
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: [0.72, 1, 0.72],
                  textShadow: [
                    "0 0 0 rgba(240,84,79,0)",
                    "0 0 18px rgba(240,84,79,.32)",
                    "0 0 0 rgba(240,84,79,0)",
                  ],
                }
          }
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          4 CUSTOMER-IMPACT BLOCKERS
        </motion.span>
      </footer>
    </motion.section>
  );
}
