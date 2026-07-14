"use client";

import { useEffect, useRef, useState } from "react";
import { verdictFor } from "@/lib/types";
import { Eyebrow } from "./ui";

/**
 * The Readiness Card — treat it like a piece of hardware product design.
 * One big serif number, a 10-segment meter, strengths/weaknesses, and a
 * muted meta line. The % counts up with slight resistance, like it's
 * being earned.
 */

function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutQuart — fast start, resistance at the end.
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(eased * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

const SEGMENTS = 10;

export function ReadinessCard({
  score,
  strengths,
  weaknesses,
  meta,
  threshold = 90,
  className = "",
}: {
  score: number;
  strengths: string[];
  weaknesses: string[];
  meta: string;
  threshold?: number;
  className?: string;
}) {
  const shown = useCountUp(score);
  const filled = Math.round((score / 100) * SEGMENTS);
  const verdict = verdictFor(score);
  const ready = score >= threshold;
  const maxList = 4;

  return (
    <div
      className={`rounded-xl border border-edge bg-surface p-8 shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${className}`}
    >
      <Eyebrow>Agent readiness</Eyebrow>

      <div className="mt-8 flex flex-col items-center gap-4">
        <div
          className="numeral text-[88px] leading-none text-ink"
          aria-label={`Readiness score ${score} percent`}
        >
          {shown}
          <span className="text-[40px] text-sub">%</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-4 rounded-full transition-colors duration-300"
                style={{
                  background:
                    i < filled ? "var(--color-accent)" : "var(--color-edge)",
                  // Segments light one by one, trailing the count-up.
                  transitionDelay: `${i * 55}ms`,
                  opacity: i < filled ? 1 : 0.8,
                }}
              />
            ))}
          </div>
          <span
            className={`whitespace-nowrap text-sm font-medium ${ready ? "text-accent" : "text-sub"}`}
          >
            {verdict}
          </span>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8">
        <div>
          <Eyebrow>Strengths</Eyebrow>
          <ul className="mt-3 space-y-2">
            {strengths.slice(0, maxList).map((s) => (
              <li key={s} className="flex items-baseline gap-2 text-sm text-ink">
                <span aria-hidden className="font-mono text-accent">
                  ✓
                </span>
                {s}
              </li>
            ))}
            {strengths.length > maxList && (
              <li className="text-sm text-mut">
                +{strengths.length - maxList} more
              </li>
            )}
          </ul>
        </div>
        <div>
          <Eyebrow>Weaknesses</Eyebrow>
          <ul className="mt-3 space-y-2">
            {weaknesses.slice(0, maxList).map((w) => (
              <li key={w} className="flex items-baseline gap-2 text-sm text-ink">
                <span aria-hidden className="font-mono text-fail">
                  ✗
                </span>
                {w}
              </li>
            ))}
            {weaknesses.length > maxList && (
              <li className="text-sm text-mut">
                +{weaknesses.length - maxList} more
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-10 border-t border-edge pt-4 text-[13px] text-mut">
        {meta}
      </div>
    </div>
  );
}
