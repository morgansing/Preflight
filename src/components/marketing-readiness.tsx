import type { CSSProperties } from "react";
import Link from "next/link";
import { runStats } from "@/lib/fixtures/run";
import styles from "./marketing-readiness.module.css";

export type MarketingReadinessProps = {
  score?: number;
  threshold?: number;
  confidence?: readonly [number, number];
  baselineScore?: number;
  regressions?: number;
  scenarios?: number;
  passed?: number;
  failed?: number;
  partial?: number;
  reportHref?: string;
  className?: string;
};

const strengths = [
  "Product questions",
  "Shipping updates",
  "Order status",
];

const weaknesses = ["Refund fraud", "Duplicate orders", "Escalations"];

const SEGMENTS = 10;

export function MarketingReadiness({
  score = 97,
  threshold = 90,
  confidence = [94, 99],
  baselineScore = 94.6,
  regressions = 0,
  scenarios = runStats.total,
  passed = runStats.pass,
  failed = runStats.fail,
  partial = runStats.partial,
  reportHref = "/share/demo",
  className = "",
}: MarketingReadinessProps) {
  const boundedScore = Math.min(100, Math.max(0, score));
  const boundedThreshold = Math.min(100, Math.max(0, threshold));
  const confidenceLow = Math.min(100, Math.max(0, confidence[0]));
  const confidenceHigh = Math.min(
    100,
    Math.max(confidenceLow, confidence[1]),
  );
  const ready = boundedScore >= boundedThreshold && regressions === 0;
  const delta = boundedScore - baselineScore;
  const filledSegments = Math.round((boundedScore / 100) * SEGMENTS);
  const variables = {
    "--score": `${boundedScore}%`,
    "--threshold": `${boundedThreshold}%`,
    "--confidence-left": `${confidenceLow}%`,
    "--confidence-width": `${confidenceHigh - confidenceLow}%`,
  } as CSSProperties;

  return (
    <section
      className={`${styles.scene} ${className}`}
      style={variables}
      aria-labelledby="marketing-readiness-title"
    >
      <article className={styles.report}>
        <header className={styles.reportHeader}>
          <div className={styles.reportIdentity}>
            <span className={styles.statusDot} aria-hidden />
            <div>
              <p id="marketing-readiness-title">
                READINESS REPORT · RUN_0147
              </p>
              <span>AURORA SUPPORT V1.3</span>
            </div>
          </div>
          <span className={styles.reportVerdict} data-ready={ready}>
            {ready ? "READY TO SHIP" : "REVIEW REQUIRED"}
          </span>
        </header>

        <div className={styles.reportMeta}>
          <span>ECOMMERCE SUPPORT SUITE V2</span>
          <span>JULY 14, 2026</span>
        </div>

        <div className={styles.readinessPanel}>
          <div className={styles.scoreCard}>
            <span className={styles.eyebrow}>AGENT READINESS</span>
            <div
              className={styles.scoreLockup}
              aria-label={`Readiness score ${boundedScore} percent`}
            >
              <strong>{boundedScore}</strong>
              <span>%</span>
            </div>
            <div className={styles.segmentRow} aria-hidden>
              {Array.from({ length: SEGMENTS }).map((_, index) => (
                <span
                  key={index}
                  data-filled={index < filledSegments}
                  style={{ animationDelay: `${70 + index * 36}ms` }}
                />
              ))}
            </div>
            <p className={styles.scoreVerdict} data-ready={ready}>
              {ready ? "Ready to ship" : "Below release threshold"}
            </p>
          </div>

          <div className={styles.categoryGrid}>
            <ReportList
              title="STRENGTHS"
              items={strengths}
              glyph="✓"
              tone="positive"
            />
            <ReportList
              title="WEAKNESSES"
              items={weaknesses}
              glyph="×"
              tone="negative"
            />
          </div>
        </div>

        <div className={styles.confidencePanel}>
          <div className={styles.confidenceHeader}>
            <span>SCORE CONFIDENCE</span>
            <span>
              95% CI · {confidenceLow}–{confidenceHigh}
            </span>
          </div>
          <div
            className={styles.confidenceTrack}
            aria-label={`Score ${boundedScore}; release threshold ${boundedThreshold}; 95 percent confidence interval ${confidenceLow} to ${confidenceHigh}`}
          >
            <span className={styles.trackBase} aria-hidden />
            <span className={styles.scoreFill} aria-hidden />
            <span className={styles.confidenceBand} aria-hidden />
            <span className={styles.thresholdMarker} aria-hidden>
              <small>GATE {boundedThreshold}</small>
            </span>
            <span className={styles.scoreMarker} aria-hidden>
              <small>{boundedScore}</small>
            </span>
          </div>
        </div>

        <div className={styles.reportSections}>
          <section className={styles.baselineSection}>
            <div>
              <span className={styles.eyebrow}>VERSUS BASELINE</span>
              <small>PINNED · RUN_0146</small>
            </div>
            <div className={styles.baselineScore}>
              <span>{baselineScore.toFixed(1)}%</span>
              <i aria-hidden>→</i>
              <strong>{boundedScore.toFixed(1)}%</strong>
              <small className={delta >= 0 ? styles.positive : styles.negative}>
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)}
              </small>
            </div>
          </section>

          <section className={styles.regressionSection}>
            <span className={styles.eyebrow}>NEWLY FAILING</span>
            <strong className={regressions === 0 ? styles.positive : styles.negative}>
              {regressions}
            </strong>
            <small>
              {regressions === 0 ? "No new regressions" : "Review before release"}
            </small>
          </section>

          <section className={styles.contentsSection}>
            <span className={styles.eyebrow}>REPORT SECTIONS</span>
            <p>
              <span>WHERE IT BREAKS</span>
              <strong>3 findings</strong>
            </p>
            <p>
              <span>RISKS THAT MATTER</span>
              <strong>5 risks</strong>
            </p>
          </section>
        </div>

        <footer className={styles.reportFooter}>
          <p>
            RUN_0147 · {scenarios.toLocaleString()} SCENARIOS · {passed} PASSED ·{" "}
            {failed} FAILED · {partial} PARTIAL
          </p>
          <Link href={reportHref}>
            FULL REPORT <span aria-hidden>→</span>
          </Link>
        </footer>
      </article>
    </section>
  );
}

function ReportList({
  title,
  items,
  glyph,
  tone,
}: {
  title: string;
  items: readonly string[];
  glyph: string;
  tone: "positive" | "negative";
}) {
  return (
    <section className={styles.reportList}>
      <span className={styles.eyebrow}>{title}</span>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <span className={styles[tone]} aria-hidden>
              {glyph}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
