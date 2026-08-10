"use client";

import Link from "next/link";
import { use } from "react";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { LiveEmpty } from "@/components/live-empty";
import { ScenarioDetail } from "@/components/scenario-detail";
import { demoOutcomes, getScenarioById, BASE_SUITE_SIZE } from "@/lib/fixtures/scenarios";
import { LIBRARY_SIZES } from "@/lib/suite-tiers";
import { useMode } from "@/lib/mode";
import styles from "@/components/evidence-browser.module.css";

/**
 * A scenario's own page — the drawer content at a shareable URL, so a
 * report, PR comment or Slack thread can point at the exact test.
 * Resolves the full 10,000-scenario space.
 */
export default function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useMode();

  if (mode === "live") return <LiveEmpty surface="the scenario library" />;

  const scenario = getScenarioById(id);

  if (!scenario) {
    return (
      <div className={`${styles.page} ${styles.detailPage} ${styles.notFound}`}>
        <section className={styles.notFoundPanel}>
          <Eyebrow>Scenario</Eyebrow>
          <h1 className={styles.notFoundTitle}>Scenario not found</h1>
          <p className={styles.notFoundBody}>
            Nothing with that id in the 10,000-scenario library.
          </p>
          <div className={styles.notFoundAction}>
            <ButtonLink href="/scenarios" variant="secondary">
              ← Back to the library
            </ButtonLink>
          </div>
        </section>
      </div>
    );
  }

  const n = parseInt(scenario.id.slice(4), 10);

  return (
    <div className={`${styles.page} ${styles.detailPage}`}>
      <header className={styles.detailHeader}>
        <Link href="/scenarios" className={styles.backLink}>
          ← Scenario library
        </Link>
        <h1 className={styles.detailTitle}>{scenario.name}</h1>
        <p className={styles.pageSubtitle}>
          The exact customer context, hidden facts, expected path, and latest-run
          evidence for this test.
        </p>
        {n > BASE_SUITE_SIZE && (
          <p className={styles.extensionNote}>
            Extension scenario. It is generated deterministically past the base
            suite and runs at library sizes of{" "}
            {LIBRARY_SIZES.find((size) => size >= n)?.toLocaleString()} and up.
          </p>
        )}
      </header>

      <section className={styles.detailSurface} aria-label="Scenario evidence definition">
        <ScenarioDetail scenario={scenario} outcome={demoOutcomes.get(scenario.id)} />
      </section>
    </div>
  );
}
