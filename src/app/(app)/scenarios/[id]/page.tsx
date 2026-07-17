"use client";

import Link from "next/link";
import { use } from "react";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { LiveEmpty } from "@/components/live-empty";
import { ScenarioDetail } from "@/components/scenario-detail";
import { demoOutcomes, getScenarioById, BASE_SUITE_SIZE } from "@/lib/fixtures/scenarios";
import { LIBRARY_SIZES } from "@/lib/suite-tiers";
import { useMode } from "@/lib/mode";

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
      <div className="mx-auto max-w-2xl px-8 py-24 text-center">
        <Eyebrow>Scenario</Eyebrow>
        <h1 className="font-display mt-3 text-3xl tracking-tight text-ink">
          Scenario not found
        </h1>
        <p className="mt-3 text-sm text-sub">
          Nothing with that id in the 10,000-scenario library.
        </p>
        <div className="mt-8">
          <ButtonLink href="/scenarios" variant="secondary">
            ← Back to the library
          </ButtonLink>
        </div>
      </div>
    );
  }

  const n = parseInt(scenario.id.slice(4), 10);

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <Link
        href="/scenarios"
        className="focus-ring rounded font-mono text-[11px] tracking-wider text-mut hover:text-sub"
      >
        ← SCENARIOS
      </Link>

      <h1 className="font-display mt-4 text-3xl tracking-tight text-ink">
        {scenario.name}
      </h1>
      {n > BASE_SUITE_SIZE && (
        <p className="mt-2 text-[13px] text-sub">
          Extension scenario — generated deterministically past the base suite; it runs
          at library sizes of {LIBRARY_SIZES.find((s) => s >= n)?.toLocaleString()} and up.
        </p>
      )}

      <div className="mt-8">
        <ScenarioDetail scenario={scenario} outcome={demoOutcomes.get(scenario.id)} />
      </div>
    </div>
  );
}
