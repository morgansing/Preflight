"use client";

import Link from "next/link";
import styles from "./auth-shell.module.css";

const WALL_CELLS = Array.from({ length: 96 }, (_, index) => {
  if (index === 37 || index === 67) return "fail";
  if (index === 51) return "review";
  return "pass";
});

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

/** A compact, faithful slice of the run wall and its attached replay evidence. */
function ProductEvidenceVisual() {
  return (
    <div
      className={styles.flightDeck}
      role="img"
      aria-label="Example Preflight evaluation: 200 scenarios judged, with 194 cleared, four blocked and two marked for review. A payment retry failure is selected with its replay evidence and missed expected path."
    >
      <div className={styles.flightDeckInner} aria-hidden="true">
        <header className={styles.flightHeader}>
          <span className={styles.flightIdentity}>
            <i /> PREFLIGHT / RUN 042
          </span>
          <span>PAYMENT RETRY · LIVE EVALUATION</span>
          <strong>COMPLETE</strong>
        </header>

        <div className={styles.flightBody}>
          <section className={styles.wallPanel}>
            <div className={styles.panelHeading}>
              <div>
                <span>SCENARIO WALL</span>
                <strong>200 / 200 judged</strong>
              </div>
              <span className={styles.wallTelemetry}>97.0% READY</span>
            </div>

            <div className={styles.coverageTrack}>
              <span className={styles.coverageFill} />
              <i className={styles.coverageBlock} />
              <i className={styles.coverageReview} />
            </div>

            <div className={styles.wallGrid}>
              {WALL_CELLS.map((status, index) => (
                <span
                  key={index}
                  className={`${styles.wallCell} ${
                    status === "fail"
                      ? styles.failCell
                      : status === "review"
                        ? styles.reviewCell
                        : ""
                  } ${
                    index === 67 ? styles.selectedCell : ""
                  }`}
                  style={{ "--cell-order": index } as React.CSSProperties}
                />
              ))}
              <span className={styles.wallScan} />
            </div>

            <div className={styles.wallMetrics}>
              <span>
                <i className={styles.passSignal} /> <strong>194</strong> clear
              </span>
              <span>
                <i className={styles.failSignal} /> <strong>4</strong> blocked
              </span>
              <span>
                <i className={styles.reviewSignal} /> <strong>2</strong> review
              </span>
            </div>
          </section>

          <section className={styles.evidencePanel}>
            <div className={styles.evidenceHeader}>
              <span>SCN-0187</span>
              <strong>× FAIL · STEP 04</strong>
            </div>

            <div className={styles.trace}>
              <span className={styles.traceLine} />
              <article
                className={styles.traceRow}
                style={{ "--row-order": 0 } as React.CSSProperties}
              >
                <i />
                <div>
                  <span>CUSTOMER</span>
                  <p>I only meant to order once.</p>
                </div>
              </article>
              <article
                className={`${styles.traceRow} ${styles.actionRow}`}
                style={{ "--row-order": 1 } as React.CSSProperties}
              >
                <i />
                <div>
                  <span>AGENT · ACTION</span>
                  <p>refund_order(&quot;#A39519&quot;)</p>
                </div>
                <b>DIVERGENCE</b>
              </article>
              <article
                className={`${styles.traceRow} ${styles.expectedRow}`}
                style={{ "--row-order": 2 } as React.CSSProperties}
              >
                <i />
                <div>
                  <span>EXPECTED PATH</span>
                  <p>Confirm which order to keep</p>
                </div>
                <b>MISSED</b>
              </article>
            </div>
          </section>
        </div>

        <footer className={styles.flightFooter}>
          <span>REPLAY EVIDENCE ATTACHED</span>
          <div className={styles.replayTrack}>
            {Array.from({ length: 7 }, (_, index) => (
              <i key={index} className={index === 3 ? styles.replayFailure : ""} />
            ))}
          </div>
          <strong>04 / 07</strong>
        </footer>
      </div>
    </div>
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

              <ProductEvidenceVisual />

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
