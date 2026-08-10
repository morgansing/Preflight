"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import styles from "./marketing-shell.module.css";

type MotionMode = "desktop" | "mobile" | "static";
type CellStatus = "pass" | "fail" | "review";

const CELL_COUNT = 24;
const PHASE_COUNT = 4;
const FAIL_INDEX = [5, 11, 17, 23] as const;
const REVIEW_INDEX = [9, 15, 21, 19] as const;

const CELL_POINTS = Array.from({ length: CELL_COUNT }, (_, index) => {
  const progress = index / (CELL_COUNT - 1);

  return {
    x: 4 + progress * 80,
    y: 48 + Math.sin(progress * Math.PI * 1.55 - 0.55) * 19,
  };
});

const statusClass: Record<CellStatus, string> = {
  pass: styles.cellPass,
  fail: styles.cellFail,
  review: styles.cellReview,
};

function statusForCell(index: number, phase: number): CellStatus {
  if (index === FAIL_INDEX[phase]) return "fail";
  if (index === REVIEW_INDEX[phase]) return "review";
  return "pass";
}

function cellStyle(index: number): CSSProperties {
  const point = CELL_POINTS[index];

  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
  };
}

export function MarketingAtmosphere() {
  const hostRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState(0);
  const [heroActive, setHeroActive] = useState(true);
  // Keep SSR and first client paint identical; resolve real mode after mount.
  const [motionMode, setMotionMode] = useState<MotionMode>("desktop");
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 420px)");
    const mobile = window.matchMedia("(max-width: 780px)");

    const updateMode = () => {
      if (reduced.matches || compact.matches) {
        setMotionMode("static");
        setPhase(PHASE_COUNT - 1);
        setHeroActive(false);
      } else if (mobile.matches) {
        setMotionMode("mobile");
        setPhase(0);
        setHeroActive(false);
      } else {
        setMotionMode("desktop");
        setHeroActive(true);
      }
      setMotionReady(true);
    };

    updateMode();
    reduced.addEventListener("change", updateMode);
    compact.addEventListener("change", updateMode);
    mobile.addEventListener("change", updateMode);

    return () => {
      reduced.removeEventListener("change", updateMode);
      compact.removeEventListener("change", updateMode);
      mobile.removeEventListener("change", updateMode);
    };
  }, []);

  useEffect(() => {
    if (!motionReady || motionMode !== "desktop") return;

    const main = hostRef.current?.closest("main");
    if (!main) return;

    const sections = Array.from(main.querySelectorAll<HTMLElement>("section")).filter(
      (section) => !section.parentElement?.closest("section"),
    );
    if (sections.length === 0) return;

    const visible = new Map<Element, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.set(entry.target, entry);
          else visible.delete(entry.target);
        });

        const active = Array.from(visible.values()).sort((a, b) => {
          const aDistance = Math.abs(
            a.boundingClientRect.top + a.boundingClientRect.height / 2 - window.innerHeight * 0.34,
          );
          const bDistance = Math.abs(
            b.boundingClientRect.top + b.boundingClientRect.height / 2 - window.innerHeight * 0.34,
          );
          return aDistance - bDistance;
        })[0];

        if (!active) return;

        const sectionIndex = sections.indexOf(active.target as HTMLElement);
        const nextPhase = Math.min(
          PHASE_COUNT - 1,
          Math.floor((sectionIndex * PHASE_COUNT) / sections.length),
        );

        setPhase((current) => (current === nextPhase ? current : nextPhase));
        setHeroActive(sectionIndex === 0);
      },
      { rootMargin: "-18% 0px -64% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [motionMode, motionReady]);

  useEffect(() => {
    const cursor = cursorRef.current;

    if (motionMode !== "desktop" || !heroActive) {
      cursor?.style.setProperty("--pointer-shift", "0px");
      return;
    }

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame: number | null = null;
    let latestX = 0.5;
    let listening = false;

    const applyPointer = () => {
      const nearestCell = Math.round(latestX * (CELL_COUNT - 1));
      const quantized = nearestCell / (CELL_COUNT - 1);
      const shift = (quantized - 0.5) * 16;
      cursor?.style.setProperty("--pointer-shift", `${shift.toFixed(2)}px`);
      frame = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;

      latestX = Math.min(1, Math.max(0, event.clientX / window.innerWidth));
      if (frame === null) frame = window.requestAnimationFrame(applyPointer);
    };

    const updatePointerListener = () => {
      if (finePointer.matches && !listening) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        listening = true;
      } else if (!finePointer.matches && listening) {
        window.removeEventListener("pointermove", onPointerMove);
        listening = false;
        cursor?.style.setProperty("--pointer-shift", "0px");
      }
    };

    updatePointerListener();
    finePointer.addEventListener("change", updatePointerListener);

    return () => {
      finePointer.removeEventListener("change", updatePointerListener);
      if (listening) window.removeEventListener("pointermove", onPointerMove);
      if (frame !== null) window.cancelAnimationFrame(frame);
      cursor?.style.setProperty("--pointer-shift", "0px");
    };
  }, [heroActive, motionMode, phase]);

  const cursorPoint = CELL_POINTS[FAIL_INDEX[phase]];

  return (
    <div
      ref={hostRef}
      className={styles.marketingAtmosphere}
      data-motion-mode={motionMode}
      aria-hidden="true"
    >
      <div className={styles.atmosphereConstellation}>
        <div className={styles.mutedCells}>
          {CELL_POINTS.map((_, index) => (
            <span
              key={`muted-${index}`}
              className={`${styles.scenarioCell} ${styles.cellMuted}`}
              style={cellStyle(index)}
            />
          ))}
        </div>

        <div key={`resolved-${phase}`} className={styles.resolvedCells}>
          {CELL_POINTS.map((_, index) => {
            const status = statusForCell(index, phase);
            return (
              <span
                key={`resolved-${index}`}
                className={`${styles.scenarioCell} ${statusClass[status]}`}
                style={cellStyle(index)}
              />
            );
          })}
        </div>

        <span
          key={`cursor-${phase}`}
          className={styles.replayCursorAnchor}
          style={{ left: `${cursorPoint.x}%`, top: `${cursorPoint.y}%` }}
        >
          <span ref={cursorRef} className={styles.replayCursor} />
        </span>
      </div>
    </div>
  );
}
