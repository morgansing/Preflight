"use client";

import Link from "next/link";
import { DifficultyLabel, Eyebrow, OutcomeChip, SeverityLabel } from "@/components/ui";
import { demoAgents } from "@/lib/fixtures/agents";
import { latestRunOutcomes } from "@/lib/fixtures/runs";
import type { Scenario } from "@/lib/types";

/** The full scenario definition + how each agent's latest run handled
 * it. Rendered in the library drawer and on the scenario's own page. */
export function ScenarioDetail({
  scenario,
  outcome,
  permalinkHref,
}: {
  scenario: Scenario;
  /** The demo run's outcome — enables the "last replay" link. */
  outcome?: string;
  /** When set (the drawer), a link to the scenario's own page. */
  permalinkHref?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 font-mono text-[12px] text-mut">
        {scenario.id} · {scenario.category}
        <SeverityLabel severity={scenario.severity} />
        <DifficultyLabel level={scenario.difficulty} />
        {outcome && (
          <Link
            href={`/replay/${scenario.id}`}
            className="focus-ring rounded text-accent hover:underline"
          >
            last replay →
          </Link>
        )}
        {permalinkHref && (
          <Link
            href={permalinkHref}
            className="focus-ring rounded text-accent hover:underline"
          >
            open page →
          </Link>
        )}
      </div>
      <Field label="Correct outcome">{scenario.rubric}</Field>
      <Field label="Customer persona">{scenario.persona}</Field>
      <Field label="Opening message">
        <p className="rounded-lg border border-edge bg-surface p-4 text-sub">
          “{scenario.openingMessage}”
        </p>
      </Field>
      <Field label="Hidden facts">
        <ul className="list-inside space-y-1.5 text-sub">
          {scenario.hiddenFacts.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      </Field>
      <Field label="Pass criteria">
        <ul className="space-y-1.5">
          {scenario.passCriteria.map((c) => (
            <li key={c} className="flex gap-2 text-sub">
              <span aria-hidden className="font-mono text-accent">✓</span>
              {c}
            </li>
          ))}
        </ul>
      </Field>
      <Field label="Must not">
        <ul className="space-y-1.5">
          {scenario.mustNot.map((c) => (
            <li key={c} className="flex gap-2 text-sub">
              <span aria-hidden className="font-mono text-mut">⊘</span>
              {c}
            </li>
          ))}
        </ul>
      </Field>
      {/* Pivot from the test to the agents: how each agent's latest run
          handled this exact scenario. */}
      <Field label="Agents on this scenario">
        <div className="space-y-2">
          {demoAgents.map((a) => {
            const result = latestRunOutcomes(a.id)?.get(scenario.id);
            return (
              <Link
                key={a.id}
                href={`/agents/${a.id}`}
                className="focus-ring flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-3.5 py-2.5 transition-colors hover:border-mut"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-ink">
                    {a.name} <span className="text-sub">{a.version}</span>
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-mut">
                    last run {a.lastRun.agoLabel}
                  </span>
                </span>
                {result ? (
                  <OutcomeChip outcome={result} />
                ) : (
                  <span className="shrink-0 font-mono text-[11px] text-mut">
                    not in last run
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}
