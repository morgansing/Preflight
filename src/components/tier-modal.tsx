"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button, Eyebrow } from "./ui";
import { GauntletMark } from "./run-badges";
import { getScenarioById, getSuite } from "@/lib/fixtures/scenarios";
import { SMOKE_SUITE } from "@/lib/suites";
import { DIFFICULTY_LABELS, type Difficulty, type Scenario } from "@/lib/types";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { GAUNTLET_SUITE_SIZE, type SuiteTier } from "@/lib/suite-tiers";
import { fmtEstimate, type Pace } from "@/lib/estimates";

/** Per-tier one-liner: what question this depth actually answers. */
const TIER_ANSWERS: Record<string, string> = {
  smoke: "Run it on every change — a fast sanity pass across all 11 categories, traps included.",
  standard:
    "The full benchmark: every hand-shaped scenario. The score that's comparable across agents, versions, and the demo.",
  extended:
    "Standard plus 300 deterministic variations — catches failures that depend on phrasing, amounts, and personas.",
  scale:
    "Enough varied repetition to expose flaky judgement — agents that pass a scenario once but not every time.",
  exhaustive: "Pre-launch depth across the whole scenario space. Start it overnight before a major release.",
  max: "The entire 10,000-scenario space. Sign-off-grade evidence — and priced like it.",
};

/**
 * The tier detail sheet — clicking a coverage tier explains it before
 * anything is selected: composition, difficulty spread, whether the
 * Gauntlet is inside, honest pricing. Selecting happens here.
 */
export function TierModal({
  tier,
  pace,
  onSelect,
  onClose,
}: {
  tier: SuiteTier;
  pace: Pace;
  onSelect: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  const stats = useMemo(() => {
    const scns: Scenario[] =
      tier.id === "smoke"
        ? (SMOKE_SUITE.map((id) => getScenarioById(id)).filter(Boolean) as Scenario[])
        : getSuite(tier.size);
    const byDiff: Record<Difficulty, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of scns) byDiff[s.difficulty]++;
    // The Gauntlet is the difficulty 4–5 slice of the base 200; every
    // tier ≥ Standard contains the base as a prefix.
    const gauntletIn =
      tier.size >= 200
        ? GAUNTLET_SUITE_SIZE
        : scns.filter((s) => parseInt(s.id.slice(4), 10) <= 200 && s.difficulty >= 4).length;
    return { byDiff, gauntletIn, total: scns.length };
  }, [tier]);

  const maxDiff = Math.max(...Object.values(stats.byDiff));

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50" role="dialog" aria-modal aria-label={`${tier.name} tier details`}>
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-up absolute left-1/2 top-1/2 max-h-[88vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-edge bg-raised p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Coverage tier</Eyebrow>
            <h2 className="font-display mt-2 text-3xl tracking-tight text-ink">
              {tier.name}
              {tier.id === "max" && (
                <span className="ml-3 align-middle font-mono text-[10px] tracking-[0.14em] text-mut">
                  SIGN-OFF
                </span>
              )}
            </h2>
          </div>
          <span className="numeral text-4xl text-ink">{tier.size.toLocaleString()}</span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-sub">{TIER_ANSWERS[tier.id] ?? tier.blurb}</p>

        <div className="mt-6 space-y-4 border-t border-edge pt-5">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-sub">Hand-shaped base scenarios</span>
            <span className="font-mono tabular-nums text-ink">{Math.min(tier.size, 200)}</span>
          </div>
          {tier.size > 200 && (
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-sub">Deterministic variations beyond the base</span>
              <span className="font-mono tabular-nums text-ink">
                {(tier.size - 200).toLocaleString()}
              </span>
            </div>
          )}

          <div>
            <div className="mb-2 text-[13px] text-sub">Difficulty spread</div>
            <div className="space-y-1.5">
              {([1, 2, 3, 4, 5] as const).map((d) => (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wider text-mut">
                    {d} · {DIFFICULTY_LABELS[d]}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge/60">
                    <div
                      className={`h-full ${d >= 4 ? "bg-warn" : "bg-accent/70"}`}
                      style={{ width: `${maxDiff ? (stats.byDiff[d] / maxDiff) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-sub">
                    {stats.byDiff[d].toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn/5 px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 text-[13px] text-sub">
              <GauntletMark />
              The Gauntlet inside this tier
            </span>
            <span className="font-mono text-[12px] tabular-nums text-warn">
              {stats.gauntletIn >= GAUNTLET_SUITE_SIZE
                ? `all ${GAUNTLET_SUITE_SIZE} hard scenarios ✓`
                : `${stats.gauntletIn} of ${GAUNTLET_SUITE_SIZE}`}
            </span>
          </div>

          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-sub">Prompt-injection security</span>
            <span className="font-mono text-[12px] text-mut">separate suite — not in any tier</span>
          </div>

          <div className="flex items-baseline justify-between border-t border-edge pt-4 text-[13px]">
            <span className="text-sub">Estimated cost · duration</span>
            <span className="font-mono tabular-nums text-ink">
              {fmtEstimate(tier.size, pace)}
              {pace.samples > 0 && (
                <span className="ml-2 text-[10px] text-mut">from your runs</span>
              )}
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button className="flex-1" onClick={onSelect}>
            Select {tier.name}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
