"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Replay, ReplayStep, Scenario } from "@/lib/types";
import type { LiveOutcome } from "@/lib/live-types";
import { Button, Eyebrow, OutcomeChip, SeverityLabel } from "@/components/ui";

/** Replay shape shared by both modes — live adds the "error" outcome. */
export type ReplayLike = Omit<Replay, "outcome"> & { outcome: LiveOutcome };

/**
 * Replay — three columns, cinematic, dark.
 * Left: what the agent saw. Centre: what the agent did. Right: the
 * expected path with the divergence moment marked like an ECG anomaly.
 */

const STEP_MS = 1800;

/** Fuzzy criterion matching — judges sometimes reword slightly. */
function matchesCriterion(list: string[] | undefined, text: string): boolean {
  if (!list || list.length === 0) return false;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const t = norm(text);
  return list.some((c) => {
    const n = norm(c);
    return n === t || n.includes(t.slice(0, 40)) || t.includes(n.slice(0, 40));
  });
}

export function ReplayView({
  scenario,
  replay,
}: {
  scenario: Scenario;
  replay: ReplayLike;
}) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [added, setAdded] = useState(false);
  const total = replay.steps.length;
  const diverged =
    replay.divergenceStep !== undefined && current >= replay.divergenceStep;
  // The verdict detail (criteria checklist, evidence) reveals once the
  // replay reaches its end — the judge speaks after the transcript.
  const finished = current >= total - 1;
  const hasVerdict =
    (replay.criteriaMet?.length ?? 0) > 0 || (replay.criteriaViolated?.length ?? 0) > 0;

  const step = useCallback(
    (dir: 1 | -1) =>
      setCurrent((c) => Math.max(0, Math.min(total - 1, c + dir))),
    [total],
  );

  // Play/pause auto-advance.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCurrent((c) => {
        if (c >= total - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [playing, total]);

  // ←/→ scrubbing, space toggles play — unless focus is on something
  // interactive (button, link, input), which keeps its own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("button, a, input, select, textarea, [contenteditable]")) return;
      if (e.key === "ArrowRight") {
        setPlaying(false);
        step(1);
      } else if (e.key === "ArrowLeft") {
        setPlaying(false);
        step(-1);
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const seen = useMemo(
    () =>
      replay.steps
        .map((s, i) => ({ ...s, i }))
        .filter(
          (s) =>
            (s.actor === "customer" && s.kind === "message") ||
            s.kind === "tool_result",
        )
        .filter((s) => s.i <= current),
    [replay.steps, current],
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="border-b border-edge bg-raised/95 px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Link
                href="/runs"
                className="focus-ring rounded font-mono text-[11px] tracking-wider text-mut hover:text-sub"
              >
                ← WALL
              </Link>
              <span className="font-mono text-[11px] tracking-wider text-mut">
                {scenario.id}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="truncate text-[15px] font-medium text-ink">
                {scenario.name}
              </h1>
              <OutcomeChip outcome={replay.outcome} />
              <SeverityLabel severity={replay.severity} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right font-mono text-[13px] tabular-nums text-sub">
              <span title="Run cost">${replay.costUsd.toFixed(3)}</span>
              <span className="mx-2 text-mut">·</span>
              <span title="Latency">{(replay.latencyMs / 1000).toFixed(1)}s</span>
              <span className="mx-2 text-mut">·</span>
              <span title="Tokens">{replay.tokens.toLocaleString()} tok</span>
            </div>
            {replay.outcome === "fail" && (
              <Button
                size="sm"
                onClick={() => setAdded(true)}
                disabled={added}
                className="disabled:opacity-100"
              >
                {added ? "✓ In regression suite" : "Add to regression suite"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Three columns */}
      <div className="grid flex-1 grid-cols-1 gap-px bg-edge lg:grid-cols-[1fr_1.3fr_1fr]">
        {/* Left — what the agent saw */}
        <section className="min-w-0 bg-bg px-6 py-6">
          <Eyebrow>What the agent saw</Eyebrow>
          <div className="mt-5 space-y-4">
            {seen.map((s) => (
              <div key={s.i} className="animate-fade-up">
                {s.actor === "customer" ? (
                  <div className="rounded-lg rounded-tl-sm border border-edge bg-surface p-4">
                    <div className="mb-1.5 font-mono text-[10px] tracking-wider text-mut">
                      CUSTOMER
                    </div>
                    <p className="text-sm leading-relaxed text-ink">{s.content}</p>
                  </div>
                ) : (
                  <ToolBlock label={`${s.label} → result`} content={s.content} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Centre — what the agent did */}
        <section className="min-w-0 bg-bg px-6 py-6">
          <Eyebrow>What the agent did</Eyebrow>
          <div className="relative mt-5 space-y-1.5">
            {replay.steps.map((s, i) => (
              <TimelineStep
                key={i}
                step={s}
                active={i === current}
                past={i < current}
                divergence={i === replay.divergenceStep}
                onClick={() => {
                  setPlaying(false);
                  setCurrent(i);
                }}
              />
            ))}
          </div>
        </section>

        {/* Right — expected path */}
        <section className="min-w-0 bg-bg px-6 py-6">
          <Eyebrow>Expected path</Eyebrow>
          <p className="mt-3 text-[13px] leading-relaxed text-sub">
            {scenario.rubric}
          </p>
          <div className="mt-5 space-y-2">
            {replay.expectedPath.map((e, i) => {
              const violated =
                (diverged && i === replay.divergenceExpected) ||
                (finished && matchesCriterion(replay.criteriaViolated, e.text));
              const met =
                finished &&
                hasVerdict &&
                !violated &&
                e.kind === "must" &&
                matchesCriterion(replay.criteriaMet, e.text);
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors duration-300 ${
                    violated
                      ? "border-fail/50 bg-fail/8 [animation:ecg-pulse_1.1s_var(--ease-out-quad)_1]"
                      : "border-edge bg-surface"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-px font-mono text-xs ${
                      e.kind === "must_not"
                        ? violated
                          ? "text-fail"
                          : "text-mut"
                        : "text-accent"
                    }`}
                  >
                    {e.kind === "must_not" ? "⊘" : "✓"}
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] tracking-wider text-mut">
                      {e.kind === "must_not" ? "MUST NOT" : "MUST"}
                    </div>
                    <p
                      className={`mt-0.5 text-[13px] leading-relaxed ${
                        violated ? "text-fail" : "text-ink"
                      }`}
                    >
                      {e.text}
                    </p>
                    {violated && (
                      <p className="mt-1.5 font-mono text-[11px] text-fail/80">
                        ✗ violated at step {String((replay.divergenceStep ?? 0) + 1).padStart(2, "0")}
                      </p>
                    )}
                    {met && (
                      <p className="animate-fade-up mt-1.5 font-mono text-[11px] text-accent/80">
                        ✓ judge confirmed met
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {replay.diagnosis && (diverged || finished) ? (
            <div className="animate-fade-up mt-5 border-t border-edge pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <Eyebrow>Diagnosis</Eyebrow>
                <span
                  className="font-mono text-[11px] tabular-nums text-mut"
                  title="Judge confidence in this verdict"
                >
                  {Math.round(replay.diagnosis.confidence * 100)}% CONFIDENCE
                </span>
              </div>
              <div className="mt-3 space-y-3">
                <DiagnosisRow label="Root cause" text={replay.diagnosis.rootCause} />
                <DiagnosisRow label="Impact" text={replay.diagnosis.impact} />
                <DiagnosisRow label="Recommended fix" text={replay.diagnosis.fix} accent />
              </div>
            </div>
          ) : (
            replay.failureReason &&
            diverged && (
              <div className="animate-fade-up mt-5 border-t border-edge pt-4">
                <Eyebrow>Judge&apos;s note</Eyebrow>
                <p className="mt-2 text-[13px] leading-relaxed text-sub">
                  {replay.failureReason}
                </p>
              </div>
            )
          )}

          {/* The judge's work: verbatim quotes, each jumping to its step. */}
          {(replay.evidence?.length ?? 0) > 0 && (diverged || finished) && (
            <div className="animate-fade-up mt-5 border-t border-edge pt-4">
              <Eyebrow>Judge&apos;s evidence</Eyebrow>
              <div className="mt-3 space-y-3">
                {replay.evidence!.map((ev, i) => {
                  const bad = matchesCriterion(replay.criteriaViolated, ev.criterion);
                  const target = Math.max(0, Math.min(total - 1, ev.step));
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3.5 ${
                        bad ? "border-fail/40 bg-fail/5" : "border-accent/25 bg-accent/5"
                      }`}
                    >
                      <div
                        className={`font-mono text-[10px] tracking-wider ${
                          bad ? "text-fail/80" : "text-accent/80"
                        }`}
                      >
                        {bad ? "VIOLATED" : "MET"}
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-sub">{ev.criterion}</p>
                      <blockquote className="mt-2 border-l-2 border-edge pl-3 text-[13px] italic leading-relaxed text-ink">
                        “{ev.quote}”
                      </blockquote>
                      <button
                        type="button"
                        onClick={() => {
                          setPlaying(false);
                          setCurrent(target);
                        }}
                        className="focus-ring mt-2 cursor-pointer rounded font-mono text-[11px] text-accent hover:underline"
                      >
                        → jump to step {String(target + 1).padStart(2, "0")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Scrubber */}
      <div className="no-print sticky bottom-0 border-t border-edge bg-raised/95 px-8 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <ScrubButton onClick={() => { setPlaying(false); step(-1); }} label="Previous step (←)">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5">
                <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ScrubButton>
            <ScrubButton onClick={() => setPlaying((p) => !p)} label={playing ? "Pause (space)" : "Play (space)"}>
              {playing ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
                  <rect x="4" y="3" width="3" height="10" rx="1" />
                  <rect x="9" y="3" width="3" height="10" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
                  <path d="M5 3.5v9l7-4.5z" />
                </svg>
              )}
            </ScrubButton>
            <ScrubButton onClick={() => { setPlaying(false); step(1); }} label="Next step (→)">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5">
                <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ScrubButton>
          </div>

          <div className="flex flex-1 items-center gap-1">
            {replay.steps.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to step ${i + 1}`}
                onClick={() => {
                  setPlaying(false);
                  setCurrent(i);
                }}
                className={`focus-ring h-1 flex-1 rounded-full transition-colors duration-200 cursor-pointer ${
                  i === replay.divergenceStep && i <= current
                    ? "bg-fail"
                    : i <= current
                      ? "bg-accent/70"
                      : "bg-edge"
                }`}
              />
            ))}
          </div>

          <span aria-hidden className="hidden items-center gap-1.5 font-mono text-[10px] tracking-wider text-mut md:flex">
            <span className="rounded border border-edge px-1 py-0.5">␣</span>
            PLAY
            <span className="text-edge">·</span>
            <span className="rounded border border-edge px-1 py-0.5">← →</span>
            STEP
          </span>
          <span className="font-mono text-[11px] tabular-nums text-mut">
            {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}

function ScrubButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="focus-ring flex size-8 items-center justify-center rounded-md text-sub transition-colors hover:bg-surface hover:text-ink cursor-pointer"
    >
      {children}
    </button>
  );
}

function DiagnosisRow({
  label,
  text,
  accent = false,
}: {
  label: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3.5 ${
        accent ? "border-accent/25 bg-accent/5" : "border-edge bg-surface"
      }`}
    >
      <div
        className={`font-mono text-[10px] uppercase tracking-wider ${
          accent ? "text-accent/80" : "text-mut"
        }`}
      >
        {label}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function ToolBlock({ label, content }: { label?: string; content: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-edge bg-surface">
      <div className="border-b border-edge px-3.5 py-2 font-mono text-[10px] tracking-wider text-mut">
        {label?.toUpperCase()}
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed text-sub">
        {content}
      </pre>
    </div>
  );
}

function TimelineStep({
  step,
  active,
  past,
  divergence,
  onClick,
}: {
  step: ReplayStep;
  active: boolean;
  past: boolean;
  divergence: boolean;
  onClick: () => void;
}) {
  const dim = !active && !past;
  return (
    <button
      onClick={onClick}
      className={`focus-ring block w-full rounded-lg text-left transition-all duration-200 cursor-pointer ${
        dim ? "opacity-35" : "opacity-100"
      }`}
    >
      <div
        className={`relative rounded-lg border p-3.5 ${
          active
            ? divergence
              ? "border-fail/60 bg-fail/8"
              : "border-accent/40 bg-raised"
            : divergence && past
              ? "border-fail/30 bg-surface"
              : "border-edge bg-surface"
        }`}
      >
        {divergence && (active || past) && (
          <div className="absolute -top-2 right-3 rounded bg-fail px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-[#170707]">
            DIVERGENCE
          </div>
        )}
        <div className="mb-1.5 flex items-center gap-2 font-mono text-[10px] tracking-wider text-mut">
          {step.kind === "reasoning" ? (
            <span className="text-warn/70">AGENT · REASONING</span>
          ) : step.kind === "tool_call" ? (
            <span className={active ? "text-accent" : ""}>
              AGENT · CALL {step.label?.toUpperCase()}
            </span>
          ) : step.kind === "tool_result" ? (
            <span>STORE · {step.label?.toUpperCase()} RESULT</span>
          ) : (
            <span>{step.actor === "agent" ? "AGENT · REPLY" : "CUSTOMER"}</span>
          )}
        </div>
        {step.kind === "tool_call" || step.kind === "tool_result" ? (
          <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-sub">
            {step.content}
          </pre>
        ) : (
          <p
            className={`text-[13px] leading-relaxed ${
              step.kind === "reasoning" ? "italic text-sub" : "text-ink"
            }`}
          >
            {step.content}
          </p>
        )}
      </div>
    </button>
  );
}
