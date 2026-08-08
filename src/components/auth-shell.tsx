"use client";

import Link from "next/link";
import styles from "./auth-shell.module.css";

const WALL = "xxpxfxxfpxfxxxpfxfxxfxpxxfxfpxxfxxfpxfxx".split("");
const cellTint: Record<string, string> = {
  p: styles.passCell,
  x: styles.failCell,
  f: styles.reviewCell,
};

function Brand({ mobile = false }: { mobile?: boolean }) {
  return (
    <Link
      href="/"
      className={`${styles.brand} ${mobile ? styles.mobileBrand : ""}`}
      aria-label="Preflight home"
    >
      <span className={styles.brandSignal} aria-hidden />
      <span>PREFLIGHT</span>
    </Link>
  );
}

/** Shared product-led frame for the login and signup routes. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden>
        <span className={styles.grid} />
        <span className={styles.glow} />
        <span className={styles.signalLine} />
      </div>

      <a href="#auth-form" className={styles.skipLink}>
        Skip to account access
      </a>

      <main className={styles.layout}>
        <section className={styles.story} aria-labelledby="auth-story-title">
          <div className={styles.storyInner}>
            <Brand />

            <div className={styles.storyCopy}>
              <p className={styles.eyebrow}>
                <span aria-hidden /> Release intelligence
              </p>
              <h2 id="auth-story-title">
                Stress the agent.
                <em>Trust the evidence.</em>
              </h2>
              <p className={styles.storyLead}>
                Put real tool paths, policy traps and edge cases between every change and your
                customers.
              </p>

              <div className={styles.reportCard} aria-label="Example Preflight readiness report">
                <div className={styles.reportHeader}>
                  <span>
                    <i aria-hidden /> PREFLIGHT / RELEASE 042
                  </span>
                  <span>200 scenarios</span>
                </div>

                <div className={styles.reportBody}>
                  <div className={styles.reportSummary}>
                    <div>
                      <p>Release readiness</p>
                      <strong>
                        193 <span>cleared</span>
                      </strong>
                    </div>
                    <span className={styles.completeChip}>Complete</span>
                  </div>

                  <div className={styles.outcomeTrack} aria-hidden>
                    <span className={styles.trackPass} />
                    <span className={styles.trackFail} />
                    <span className={styles.trackReview} />
                  </div>

                  <div className={styles.metrics}>
                    <div>
                      <strong>193</strong>
                      <span>Passed</span>
                    </div>
                    <div>
                      <strong>5</strong>
                      <span>Blocked</span>
                    </div>
                    <div>
                      <strong>2</strong>
                      <span>Review</span>
                    </div>
                  </div>

                  <div className={styles.wall} role="img" aria-label="Scenario result wall">
                    {WALL.map((cell, index) => (
                      <span key={index} className={cellTint[cell]} aria-hidden />
                    ))}
                  </div>
                </div>

                <div className={styles.reportFooter}>
                  <span>Replay evidence attached</span>
                  <strong>
                    <i aria-hidden /> Decision ready
                  </strong>
                </div>
              </div>

              <div className={styles.proofPoints} aria-label="Preflight capabilities">
                <span>Real tool paths</span>
                <span>Policy-aware judges</span>
                <span>Replayable evidence</span>
              </div>
            </div>

            <p className={styles.storyFooter}>THE FLIGHT SIMULATOR FOR AI AGENTS</p>
          </div>
        </section>

        <section className={styles.formRegion} aria-label="Account access">
          <Brand mobile />
          <div id="auth-form" className={styles.formCard} tabIndex={-1}>
            <div className={styles.formCardTop} aria-hidden>
              <span>
                <i /> Workspace access
              </span>
              <span>Local preview</span>
            </div>
            <div className={styles.formContent}>{children}</div>
          </div>
          <p className={styles.localNote}>
            <span aria-hidden /> Browser-local preview · no password stored
          </p>
        </section>
      </main>
    </div>
  );
}
