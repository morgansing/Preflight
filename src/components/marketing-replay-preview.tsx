import type { CSSProperties } from "react";
import { paymentRetryDemo } from "@/lib/marketing-demo";
import styles from "./marketing-replay-preview.module.css";

export function MarketingReplayPreview() {
  return (
    <section
      className={styles.window}
      aria-label="Preflight replay preview for failed payment retry scenario SCN-0187"
    >
      <header className={styles.topbar}>
        <span>{paymentRetryDemo.scenarioId} · {paymentRetryDemo.title}</span>
        <span className={styles.fail}>
          FAIL · STEP {String(paymentRetryDemo.failureStep).padStart(2, "0")}
        </span>
      </header>

      <div
        className={styles.viewport}
        role="region"
        aria-label="Scrollable three-column replay comparison"
        tabIndex={0}
      >
        <div className={styles.columns}>
          <div className={styles.column}>
            <span className={styles.columnLabel}>WHAT THE AGENT SAW</span>
            <div className={styles.card}>
              <small>CUSTOMER</small>
              <p>{paymentRetryDemo.customer}</p>
            </div>
            <div className={styles.card}>
              <small>SEARCH_ORDERS · RESULT</small>
              <code>
                {paymentRetryDemo.orderResult[0]}
                <br />
                {paymentRetryDemo.orderResult[1]}
              </code>
            </div>
          </div>

          <div className={styles.column}>
            <span className={styles.columnLabel}>WHAT THE AGENT DID</span>
            <div className={styles.eventRail}>
              {paymentRetryDemo.events.map((event, index) => (
                <div
                  className={`${styles.event} ${
                    "failed" in event && event.failed ? styles.badEvent : ""
                  }`}
                  key={event.label}
                  style={{ "--event": index } as CSSProperties}
                >
                  <small>{event.label}</small>
                  <p>{event.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.column}>
            <span className={styles.columnLabel}>EXPECTED PATH</span>
            <p className={styles.expected}>
              {paymentRetryDemo.expected}
            </p>
            {paymentRetryDemo.checks.map(([status, text]) => (
              <div
                className={status === "MISSED" ? styles.missed : styles.pathCard}
                key={text}
              >
                <small>{status}</small>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className={styles.timeline} aria-label="Replay step 4 of 6">
        {Array.from({ length: 6 }, (_, index) => (
          <span className={index === 3 ? styles.timelineFail : ""} key={index} />
        ))}
        <i aria-hidden />
      </footer>

      <span className={styles.swipeHint} aria-hidden>
        SWIPE TO COMPARE →
      </span>
    </section>
  );
}
