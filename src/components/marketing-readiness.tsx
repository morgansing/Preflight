import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "./marketing-readiness.module.css";

export type MarketingReadinessProps = {
  score?: number;
  threshold?: number;
  confidence?: readonly [number, number];
  baselineScore?: number;
  regressions?: number;
  scenarios?: number;
  reportHref?: string;
  className?: string;
};

const evidence = [
  {
    number: "01",
    label: "Proof replay",
    detail: "Every failed decision",
  },
  {
    number: "02",
    label: "Root cause",
    detail: "Failures grouped by cause",
  },
  {
    number: "03",
    label: "Release check",
    detail: "Threshold + regressions",
  },
];

export function MarketingReadiness({
  score = 97,
  threshold = 90,
  confidence = [94, 99],
  baselineScore = 94.6,
  regressions = 0,
  scenarios = 200,
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
      <div className={styles.sceneGrid} aria-hidden />
      <div className={styles.sceneGlow} aria-hidden />
      <div className={styles.signalOrbit} aria-hidden>
        <i />
      </div>

      <div className={styles.report}>
        <header className={styles.reportHeader}>
          <div>
            <span className={styles.liveDot} aria-hidden />
            <p id="marketing-readiness-title">READINESS REPORT · RELEASE 042</p>
          </div>
          <span className={styles.verified}>VERIFIED RESULT</span>
        </header>

        <div className={styles.scoreRegion}>
          <div
            className={styles.scoreRing}
            aria-label={`Readiness score ${boundedScore} percent`}
          >
            <div>
              <strong>{boundedScore}</strong>
              <span>%</span>
            </div>
          </div>

          <div className={styles.scoreSummary}>
            <span className={styles.summaryLabel}>RELEASE VERDICT</span>
            <h3>{ready ? "Ready to ship" : "Review required"}</h3>
            <p>
              {ready
                ? `Score clears the ${boundedThreshold}% threshold with no new regressions.`
                : `The release does not yet clear every configured gate.`}
            </p>
            <div className={styles.verdictChip} data-ready={ready}>
              <span aria-hidden>{ready ? "✓" : "!"}</span>
              {ready ? "PASS" : "HOLD"}
            </div>
          </div>
        </div>

        <div className={styles.thresholdPanel}>
          <div className={styles.thresholdHeader}>
            <span>SCORE CONFIDENCE</span>
            <span>
              95% CI · {confidenceLow}–{confidenceHigh}
            </span>
          </div>
          <div
            className={styles.thresholdTrack}
            aria-label={`Score ${boundedScore}; release threshold ${boundedThreshold}; 95 percent confidence interval ${confidenceLow} to ${confidenceHigh}`}
          >
            <span className={styles.trackBase} aria-hidden />
            <span className={styles.scoreFill} aria-hidden />
            <span className={styles.confidenceBand} aria-hidden />
            <span className={styles.thresholdMarker} aria-hidden>
              <i />
              <small>GATE {boundedThreshold}</small>
            </span>
            <span className={styles.scoreMarker} aria-hidden>
              <i />
              <small>{boundedScore}</small>
            </span>
          </div>
          <div className={styles.trackTicks} aria-hidden>
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        <div className={styles.evidenceFlow}>
          {evidence.map((item, index) => (
            <div className={styles.evidenceItem} key={item.number}>
              <span className={styles.evidenceNumber}>{item.number}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </div>
              <span className={styles.evidenceCheck} aria-label="Available">
                ✓
              </span>
              {index < evidence.length - 1 && (
                <span className={styles.evidenceLine} aria-hidden>
                  <i />
                </span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.reportFooter}>
          <div>
            <span>TEST COVERAGE</span>
            <strong>{scenarios.toLocaleString()}</strong>
            <small>scenarios judged</small>
          </div>
          <div>
            <span>BASELINE</span>
            <strong className={delta >= 0 ? styles.positive : styles.negative}>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}
            </strong>
            <small>score movement</small>
          </div>
          <div>
            <span>NEW REGRESSIONS</span>
            <strong className={regressions === 0 ? styles.positive : styles.negative}>
              {regressions}
            </strong>
            <small>{regressions === 0 ? "none detected" : "newly broken"}</small>
          </div>
          <div className={styles.reportAction}>
            <span>DECISION PACKET</span>
            <Link href={reportHref}>
              Open evidence <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>

      <aside className={styles.baselineCard} aria-label="Pinned baseline comparison">
        <div className={styles.baselineTop}>
          <span>PINNED BASELINE</span>
          <span>MAIN · RUN 041</span>
        </div>
        <div className={styles.baselineScore}>
          <span>{baselineScore.toFixed(1)}</span>
          <i aria-hidden>→</i>
          <strong>{boundedScore.toFixed(1)}</strong>
        </div>
        <div className={styles.baselineRows}>
          <div>
            <span>Score movement</span>
            <strong className={delta >= 0 ? styles.positive : styles.negative}>
              {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}
            </strong>
          </div>
          <div>
            <span>Newly broken</span>
            <strong className={regressions === 0 ? styles.positive : styles.negative}>
              {regressions}
            </strong>
          </div>
        </div>
      </aside>

      <div className={styles.gateCard} data-ready={ready}>
        <div>
          <span className={styles.gatePulse} aria-hidden />
          <p>RELEASE GATE</p>
        </div>
        <strong>{ready ? "PASSING" : "BLOCKED"}</strong>
        <small>{ready ? "evidence attached" : "action required"}</small>
      </div>
    </section>
  );
}
