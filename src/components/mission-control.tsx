"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { demoRun, DEMO_RUN_DURATION_MS } from "@/lib/fixtures/run";
import { scenarioById } from "@/lib/fixtures/scenarios";
import type { RunCell } from "@/lib/types";
import { useMode } from "@/lib/mode";
import {
  addSessionRun,
  buildCells,
  buildSessionRun,
  canLinkReplay,
  nextRunId,
  useSessionRuns,
  type DemoSuiteId,
  type SessionRun,
} from "@/lib/demo-runs";
import { DemoRunLauncher } from "./demo-run-launcher";
import { Button, ButtonLink } from "./ui";
import shellStyles from "./run-wall-shell.module.css";

/**
 * Mission Control — the signature screen. A full-bleed wall of scenario
 * cells that pulse while executing and settle to pass/fail/partial. In
 * demo mode the fill-in replays scripted timestamps, so it looks live
 * but is identical every time.
 */

type CellState = "pending" | "running" | "pass" | "fail" | "partial";

function stateAt(cell: RunCell, elapsed: number): CellState {
  if (elapsed >= cell.resolveAt) return cell.outcome;
  if (elapsed >= cell.startAt) return "running";
  return "pending";
}

function useRunClock(
  loop: boolean,
  loopPauseMs = 3000,
  durationMs = DEMO_RUN_DURATION_MS,
  active = true,
) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    // Reduced motion: the looping showcase wall renders settled instead
    // of replaying forever. One-shot runs still progress — their cell
    // animations are CSS, which already respects the preference.
    if (loop && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setElapsed(durationMs), 0);
      return () => clearTimeout(id);
    }
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      startRef.current ??= now;
      if (!activeRef.current || document.hidden) {
        // Pause while the tab is hidden — shift the start forward so
        // elapsed stays frozen instead of jumping on return.
        startRef.current += dt;
        return;
      }
      const e = now - startRef.current;
      if (loop && e > durationMs + loopPauseMs) {
        startRef.current = now;
        setElapsed(0);
        return;
      }
      setElapsed(Math.min(e, durationMs));
    }, loop ? 240 : 120);
    return () => clearInterval(id);
  }, [loop, loopPauseMs, durationMs]);

  const restart = () => {
    startRef.current = performance.now();
    setElapsed(0);
  };

  return { elapsed, restart };
}

const cellStyles: Record<CellState, string> = {
  pending: "bg-raised/60",
  running: "bg-accent/35 animate-pulse-cell",
  pass: "bg-accent/12 text-accent [animation:settle-in_.35s_var(--ease-out-quad)_both]",
  fail: "bg-fail/18 text-fail [animation:fail-pop_.6s_var(--ease-out-quad)_both]",
  partial: "bg-warn/15 text-warn [animation:settle-in_.35s_var(--ease-out-quad)_both]",
};

const cellGlyph: Record<string, string> = { pass: "✓", fail: "✗", partial: "◐" };

const Cell = memo(function Cell({
  state,
  title,
  interactive,
  onOpen,
}: {
  state: CellState;
  title: string;
  interactive: boolean;
  onOpen?: () => void;
}) {
  const resolved = state === "pass" || state === "fail" || state === "partial";
  const body = (
    <span
      className={`flex aspect-square w-full items-center justify-center rounded-[4px] text-[10px] leading-none transition-colors duration-300 ${cellStyles[state]} ${
        interactive && resolved
          ? "cursor-pointer hover:ring-1 hover:ring-mut"
          : ""
      }`}
    >
      {resolved ? cellGlyph[state] : null}
    </span>
  );
  if (!interactive || !resolved) return <div title={title}>{body}</div>;
  return (
    <button
      onClick={onOpen}
      title={title}
      className="focus-ring block w-full rounded-[4px]"
    >
      {body}
    </button>
  );
});

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function useWallStats(elapsed: number, cells: RunCell[] = demoRun.cells) {
  return useMemo(() => {
    let pass = 0,
      fail = 0,
      partial = 0,
      cost = 0;
    for (const c of cells) {
      if (elapsed >= c.resolveAt) {
        cost += c.costUsd;
        if (c.outcome === "pass") pass++;
        else if (c.outcome === "fail") fail++;
        else partial++;
      }
    }
    const resolved = pass + fail + partial;
    return {
      pass,
      fail,
      partial,
      resolved,
      total: cells.length,
      passRate: resolved ? Math.round((pass / resolved) * 100) : 0,
      costUsd: cost,
      done: resolved === cells.length,
    };
  }, [elapsed, cells]);
}

export function Wall({
  elapsed,
  interactive = true,
  className = "",
  cells = demoRun.cells,
  linkFor,
}: {
  elapsed: number;
  interactive?: boolean;
  className?: string;
  cells?: RunCell[];
  /** Where a settled cell links; null = not clickable (defaults to its replay). */
  linkFor?: (cell: RunCell) => string | null;
}) {
  const router = useRouter();
  return (
    <div
      className={`grid gap-1.5 ${className}`}
      style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
      role="grid"
      aria-label="Scenario run wall"
    >
      {cells.map((cell) => {
        const s = scenarioById.get(cell.scenarioId);
        const state = stateAt(cell, elapsed);
        const href = linkFor ? linkFor(cell) : `/replay/${cell.scenarioId}`;
        return (
          <Cell
            key={cell.scenarioId}
            state={state}
            interactive={interactive && href !== null}
            title={`${cell.scenarioId} · ${s?.name ?? ""}${
              state === "pass" || state === "fail" || state === "partial"
                ? ` · ${state}`
                : ""
            }`}
            onOpen={
              interactive && href ? () => router.push(href) : undefined
            }
          />
        );
      })}
    </div>
  );
}

/** Compact autoplaying wall for the landing page — muted, looping. */
export function WallLoop({ className = "" }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "120px 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const { elapsed } = useRunClock(
    true,
    3000,
    DEMO_RUN_DURATION_MS,
    active,
  );
  const stats = useWallStats(elapsed);
  return (
    <div
      ref={rootRef}
      className={`rounded-xl border border-edge bg-surface p-6 shadow-card ${className}`}
    >
      <div className="mb-4 flex items-center justify-between font-mono text-[11px] tracking-wider text-mut">
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${stats.done ? "bg-mut" : "bg-accent animate-pulse-cell"}`}
          />
          {demoRun.agent} {demoRun.agentVersion} · {demoRun.suite.toUpperCase()}
        </span>
        <span className="tabular-nums">
          {stats.resolved}/{stats.total} · {stats.passRate}% PASS
        </span>
      </div>
      <Wall elapsed={elapsed} interactive={false} />
    </div>
  );
}

/** The full Mission Control screen. */
export function MissionControl() {
  // A launched fake test replaces the pre-baked demo run until reset.
  const [fake, setFake] = useState<{ run: SessionRun; cells: RunCell[] } | null>(null);
  const [showLauncher, setShowLauncher] = useState(false);
  const sessionRuns = useSessionRuns();
  const durationMs = fake ? fake.run.durationMs : DEMO_RUN_DURATION_MS;
  const { elapsed, restart } = useRunClock(false, 3000, durationMs);
  const cells = fake ? fake.cells : demoRun.cells;
  const stats = useWallStats(elapsed, cells);
  const eta = Math.max(0, durationMs - elapsed);
  const { setMode } = useMode();
  const router = useRouter();
  const savedRef = useRef<string | null>(null);

  // Persist a finished fake run exactly once.
  useEffect(() => {
    if (fake && stats.done && savedRef.current !== fake.run.id) {
      savedRef.current = fake.run.id;
      addSessionRun(fake.run);
    }
  }, [fake, stats.done]);

  const launchFake = (agentId: string, suiteId: DemoSuiteId) => {
    const run = buildSessionRun(agentId, suiteId, nextRunId(sessionRuns));
    setFake({ run, cells: buildCells(run) });
    setShowLauncher(false);
    restart();
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* This is the fixed demo. The real launcher — pick your agent, the
          suite size, run it — lives in Live mode. Make that reachable. */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-accent/20 bg-accent/5 px-8 py-3">
        <p className="text-[13px] text-sub">
          <span className="font-medium text-ink">This is a demo run</span> — a pre-baked
          200-scenario benchmark. Try launching one yourself: pick an agent and a suite,
          right here in demo mode. When you&apos;re ready to test your own agent, switch to Live.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowLauncher((v) => !v)}>
            Run a fake test
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMode("live");
              router.push("/runs");
            }}
          >
            Test your own agent →
          </Button>
        </div>
      </div>
      {showLauncher && (
        <DemoRunLauncher onLaunch={launchFake} onClose={() => setShowLauncher(false)} />
      )}
      {/* Floating header bar — a raised surface, no glass. */}
      <div className={`${shellStyles.stickyHeader} sticky z-10 border-b border-edge bg-raised/95 px-8 py-4 backdrop-blur-none`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow">
              Run {fake ? fake.run.id : demoRun.id}
              {fake && <span className="ml-2 text-accent">FAKE TEST</span>}
            </div>
            <div className="mt-1 text-[15px] font-medium text-ink">
              {fake ? `${fake.run.agentName} ${fake.run.agentVersion}` : `${demoRun.agent} ${demoRun.agentVersion}`}
              <span className="ml-2 text-sub">
                · {fake ? `${fake.run.suiteId} suite · ${fake.run.scenarioIds.length} scenarios` : demoRun.suite}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-8 font-mono text-sm tabular-nums">
            <Stat
              label="Pass rate"
              value={`${stats.passRate}%`}
              tone={stats.resolved > 0 ? "accent" : "mut"}
            />
            <Stat label="Complete" value={`${stats.resolved}/${stats.total}`} />
            <Stat
              label={stats.done ? "Elapsed" : "Elapsed · ETA"}
              value={
                stats.done
                  ? fmtClock(elapsed)
                  : `${fmtClock(elapsed)} · ${fmtClock(eta)}`
              }
            />
            <Stat label="Cost" value={`$${stats.costUsd.toFixed(2)}`} />
            <ButtonLink variant="ghost" size="sm" href="/runs/history">
              Run history
            </ButtonLink>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFake(null);
                restart();
              }}
            >
              {fake ? "Back to demo run" : "Replay demo run"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 py-8">
        <Wall
          elapsed={elapsed}
          className="mx-auto max-w-5xl"
          cells={cells}
          linkFor={
            fake
              ? (cell) =>
                  canLinkReplay(cell.scenarioId, cell.outcome)
                    ? `/replay/${cell.scenarioId}`
                    : null
              : undefined
          }
        />

        <div className="mx-auto mt-6 flex max-w-5xl items-center justify-between text-[13px]">
          <div className="flex items-center gap-6 text-sub">
            <LegendItem colorVar="--color-accent" glyph="✓" label={`Pass ${stats.pass}`} />
            <LegendItem colorVar="--color-fail" glyph="✗" label={`Fail ${stats.fail}`} />
            <LegendItem colorVar="--color-warn" glyph="◐" label={`Partial ${stats.partial}`} />
          </div>
          {stats.done && (
            <a
              href={fake ? `/runs/${fake.run.id}` : "/reports"}
              className="focus-ring animate-fade-in rounded-md text-accent hover:underline"
            >
              {fake
                ? `Run complete — open ${fake.run.id} →`
                : "Run complete — view the readiness report →"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "accent" | "mut";
}) {
  const color =
    tone === "accent" ? "text-accent" : tone === "mut" ? "text-mut" : "text-ink";
  return (
    <div className="text-right">
      <div className="eyebrow">{label}</div>
      <div className={`mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function LegendItem({
  colorVar,
  glyph,
  label,
}: {
  colorVar: string;
  glyph: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden style={{ color: `var(${colorVar})` }}>
        {glyph}
      </span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
