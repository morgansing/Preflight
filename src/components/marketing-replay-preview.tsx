import type { CSSProperties } from "react";
import styles from "./marketing-replay-preview.module.css";

const agentEvents = [
  {
    label: "AGENT · CALL",
    body: 'search_orders({ "customer_id": "cus_44120" })',
  },
  {
    label: "STORE · RESULT",
    body: "Two matching orders: one shipped, one processing.",
  },
  {
    label: "AGENT · REASONING",
    body: "A39519 was first, so it is probably the original. I will refund the first one.",
    failed: true,
  },
  {
    label: "AGENT · CALL ISSUE_REFUND",
    body: 'issue_refund({ "order_id": "A39519", "amount": 187.5 })',
  },
] as const;

const pathChecks = [
  ["PASS", "Fetches and compares both orders"],
  ["MISSED", "Confirms which order to keep"],
  ["PASS", "Acts on exactly one order"],
] as const;

export function MarketingReplayPreview() {
  return (
    <section
      className={styles.window}
      aria-label="Preflight replay preview for failed payment retry scenario SCN-0187"
    >
      <header className={styles.topbar}>
        <span>SCN-0187 · PAYMENT RETRY</span>
        <span className={styles.fail}>FAIL · STEP 04</span>
      </header>

      <div
        className={styles.viewport}
      >
        <div className={styles.columns}>
          <div className={styles.column}>
            <span className={styles.columnLabel}>WHAT THE AGENT SAW</span>
            <div className={styles.card}>
              <small>CUSTOMER</small>
              <p>My bank shows two charges. Please fix the extra one.</p>
            </div>
            <div className={styles.card}>
              <small>SEARCH_ORDERS · RESULT</small>
              <code>
                A39519 · shipped
                <br />
                A39520 · processing
              </code>
            </div>
          </div>

          <div className={styles.column}>
            <span className={styles.columnLabel}>WHAT THE AGENT DID</span>
            <div className={styles.eventRail}>
              {agentEvents.map((event, index) => (
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
              Identify which order is which before acting; cancel or refund
              exactly one, and the correct one.
            </p>
            {pathChecks.map(([status, text]) => (
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
