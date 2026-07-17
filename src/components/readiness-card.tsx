"use client";

import Link from "next/link";
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

/** Neutral one-liners describing what each category covers — read fine
 * under both a strength (✓) and a weakness (✗). */
const CATEGORY_DETAIL: Record<string, string> = {
  "Product questions": "specs, sizing, compatibility, warranty",
  "Shipping updates": "tracking, delays, delivery disputes",
  "Order status": "processing, payment holds, cancellations",
  "Returns & exchanges": "windows, final-sale, correct remedy",
  "Refund fraud": "checking evidence before paying out",
  "Duplicate orders": "disambiguating double charges",
  "Escalations": "handing off legal, safety, over-threshold",
  "Account & identity": "verifying identity before changes",
  "Discounts & promotions": "promo validity, goodwill limits",
  "Inventory & stock": "live stock and restock dates",
  "Prompt injection": "ignoring instructions hidden in data",
};

export function ReadinessCard({
  score,
  strengths,
  weaknesses,
  meta,
  threshold = 90,
  hrefs,
  reportHref,
  className = "",
}: {
  score: number;
  strengths: string[];
  weaknesses: string[];
  meta: string;
  threshold?: number;
  /** Optional category → link (e.g. a failing replay). Categories
   * without an entry render as plain text. */
  hrefs?: Record<string, string | undefined>;
  /** Optional link rendered on the meta line ("full report →"). */
  reportHref?: string;
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
          <CategoryList items={strengths} glyph="✓" glyphClass="text-accent" hrefs={hrefs} maxList={maxList} />
        </div>
        <div>
          <Eyebrow>Weaknesses</Eyebrow>
          <CategoryList items={weaknesses} glyph="✗" glyphClass="text-fail" hrefs={hrefs} maxList={maxList} />
        </div>
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-4 border-t border-edge pt-4 text-[13px] text-mut">
        <span>{meta}</span>
        {reportHref && (
          <Link
            href={reportHref}
            className="focus-ring shrink-0 rounded font-mono text-[11px] text-accent hover:underline"
          >
            full report →
          </Link>
        )}
      </div>
    </div>
  );
}

function CategoryList({
  items,
  glyph,
  glyphClass,
  hrefs,
  maxList,
}: {
  items: string[];
  glyph: string;
  glyphClass: string;
  hrefs?: Record<string, string | undefined>;
  maxList: number;
}) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.slice(0, maxList).map((name) => {
        const href = hrefs?.[name];
        const body = (
          <>
            {name}
            {href && (
              <span aria-hidden className="ml-1.5 font-mono text-[11px] text-accent">
                →
              </span>
            )}
            {CATEGORY_DETAIL[name] && (
              <span className="mt-0.5 block text-[11px] leading-snug text-mut">
                {CATEGORY_DETAIL[name]}
              </span>
            )}
          </>
        );
        return (
          <li key={name} className="flex items-baseline gap-2 text-sm text-ink">
            <span aria-hidden className={`font-mono ${glyphClass}`}>
              {glyph}
            </span>
            {href ? (
              <Link
                href={href}
                title="Watch a failing replay"
                className="focus-ring min-w-0 rounded transition-colors hover:text-accent"
              >
                {body}
              </Link>
            ) : (
              <span className="min-w-0">{body}</span>
            )}
          </li>
        );
      })}
      {items.length > maxList && (
        <li className="text-sm text-mut">+{items.length - maxList} more</li>
      )}
    </ul>
  );
}
