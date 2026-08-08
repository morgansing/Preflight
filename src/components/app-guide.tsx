"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useMode } from "@/lib/mode";
import { openPalette } from "./command-palette";
import styles from "./app-guide.module.css";

type GuideContextValue = {
  open: boolean;
  showGuide: (opener?: HTMLElement | null) => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

const steps = [
  {
    number: "01",
    signal: "Try",
    title: "Watch the workflow once",
    body: "Open a guided run and watch the result wall settle before connecting or configuring anything.",
    action: "Open the run wall",
    href: "/runs",
  },
  {
    number: "02",
    signal: "Connect",
    title: "Register the agent",
    body: "Use a runnable OpenAI-compatible or HTTP endpoint, or keep exploring with the reference agent.",
    action: "Connect an agent",
    href: "/agents/connect",
  },
  {
    number: "03",
    signal: "Teach",
    title: "Define correct behaviour",
    body: "Turn policies, prompts, transcripts or seven guided answers into an approved Rulebook. Live mode can generate its runnable custom scenarios.",
    action: "Build the Rulebook",
    href: "/setup",
  },
  {
    number: "04",
    signal: "Run",
    title: "Choose the right pressure",
    body: "Use Smoke for a first check, Standard for the 200-scenario base, or target Gauntlet, Security and Rulebook suites.",
    action: "Choose a suite",
    href: "/runs",
  },
  {
    number: "05",
    signal: "Review",
    title: "Follow the evidence",
    body: "Open misses as replays, inspect root causes and coverage, then compare the two most recent completed runs.",
    action: "Open readiness reports",
    href: "/reports",
  },
] as const;

const pageGuides = [
  {
    path: "/agents/connect",
    label: "Connect agent",
    title: "Bring one runnable agent into the simulator.",
    body: "Register an OpenAI-compatible, HTTP or reference agent and verify the connection before the first run.",
  },
  {
    path: "/runs/history",
    label: "Run history",
    title: "Return to evidence that has already settled.",
    body: "Reopen completed runs, compare scores and jump back into the wall or report behind each result.",
  },
  {
    path: "/replay",
    label: "Replay",
    title: "See the exact decision that changed the outcome.",
    body: "Read what the agent saw, what it did and the expected path side by side at the first divergence.",
  },
  {
    path: "/dashboard",
    label: "Dashboard",
    title: "Your workspace signal at a glance.",
    body: "See active evaluations, recent evidence and the latest readiness result without opening every run.",
  },
  {
    path: "/setup",
    label: "Setup",
    title: "Turn policy into testable rules.",
    body: "Build and approve the Rulebook Preflight uses to generate scenarios specific to your operation.",
  },
  {
    path: "/agents",
    label: "Agents",
    title: "Choose what Preflight will evaluate.",
    body: "Connect endpoints, inspect agent versions and select the subject for the next evaluation.",
  },
  {
    path: "/scenarios",
    label: "Scenarios",
    title: "Inspect the situations behind the score.",
    body: "Browse realistic customer setups, hidden facts, pass criteria, must-nots and difficulty levels.",
  },
  {
    path: "/runs",
    label: "Run wall",
    title: "Put the agent through the suite.",
    body: "Choose coverage, launch the evaluation and watch every scenario resolve into evidence on the wall.",
  },
  {
    path: "/reports",
    label: "Reports",
    title: "Read the verdict behind the percentage.",
    body: "Review confidence, coverage gaps, root-cause clusters and proof replays before making a release decision.",
  },
  {
    path: "/benchmark",
    label: "Benchmark",
    title: "See what changed between completed runs.",
    body: "Compare the two most recent completed runs to find newly broken and newly fixed behaviour.",
  },
  {
    path: "/billing",
    label: "Billing & usage",
    title: "Understand the evaluation allowance.",
    body: "Review the current plan, simulation usage and the capacity available for upcoming suites.",
  },
] as const;

const fallbackGuide = {
  label: "Workspace",
  title: "Follow the evidence from agent to release.",
  body: "Use the five-step field guide below whenever you are unsure where to go next.",
};

export function AppGuideProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode } = useMode();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(panelRef, open);

  const currentGuide = useMemo(() => {
    if (mode === "live" && pathname.startsWith("/scenarios")) {
      return {
        label: "Scenarios",
        title: "Live scenario evidence begins with a run.",
        body: "Connect an agent or use the reference agent, then run a suite. Build policy-specific coverage from Setup.",
      };
    }
    return pageGuides.find((guide) => pathname.startsWith(guide.path)) ?? fallbackGuide;
  }, [mode, pathname]);

  const showGuide = useCallback((opener?: HTMLElement | null) => {
    openerRef.current = opener ?? (document.activeElement as HTMLElement | null);
    setOpen(true);
  }, []);

  const closeGuide = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  const followGuideLink = useCallback(() => {
    openerRef.current = null;
    setOpen(false);
  }, []);

  const openQuickJump = useCallback(() => {
    const returnTarget = openerRef.current;
    setOpen(false);
    window.requestAnimationFrame(() => {
      returnTarget?.focus();
      openPalette();
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.preflightGuide = "open";
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeGuide();
      }
    };
    const onHistoryChange = () => setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onHistoryChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onHistoryChange);
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.preflightGuide;
    };
  }, [closeGuide, open]);

  return (
    <GuideContext.Provider value={{ open, showGuide }}>
      {children}
      {open && (
        <div className={styles.dialogLayer}>
          <div className={styles.backdrop} aria-hidden="true" onClick={closeGuide} />
          <div
            id="preflight-guide"
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preflight-guide-title"
            aria-describedby="preflight-guide-description"
          >
            <header className={styles.header}>
              <div>
                <span className={styles.kicker}>
                  <i aria-hidden="true" /> PREFLIGHT / FIELD GUIDE
                </span>
                <h2 id="preflight-guide-title">How Preflight works</h2>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                className={styles.closeButton}
                onClick={closeGuide}
                aria-label="Close How Preflight works"
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className={styles.scrollBody}>
              <p id="preflight-guide-description" className={styles.intro}>
                Choose an agent and a test suite. Preflight seeds a simulated store, lets the
                agent work each scenario, judges the transcript and keeps the evidence behind
                every result.
              </p>

              <section className={styles.currentSurface} aria-labelledby="current-surface-title">
                <span>{currentGuide.label} / You are here</span>
                <h3 id="current-surface-title">{currentGuide.title}</h3>
                <p>{currentGuide.body}</p>
              </section>

              <section className={styles.modeNote} aria-label={`${mode} environment guidance`}>
                <div className={styles.modeLabel}>
                  <i aria-hidden="true" /> {mode.toUpperCase()} ENVIRONMENT
                </div>
                <p>
                  {mode === "demo"
                    ? "A fixture-backed product tour. Fake runs teach the workflow; they are not evaluations of your agent."
                    : "Runs use the selected connected or reference agent against the simulated store. Sandbox and provider state stay visibly labelled."}
                </p>
                <Link href="/runs" onClick={followGuideLink}>
                  {mode === "demo" ? "Try a fake run" : "Open the run launcher"} <span aria-hidden="true">→</span>
                </Link>
              </section>

              <button type="button" className={styles.quickJump} onClick={openQuickJump}>
                <span>
                  <strong>Jump anywhere</strong>
                  <small>Open a page, agent, run or scenario</small>
                </span>
                <kbd>CTRL / CMD K</kbd>
              </button>

              <div className={styles.sectionHeading}>
                <span>THE FIVE-STEP FLIGHT PLAN</span>
                <span>01—05</span>
              </div>

              <ol className={styles.steps}>
                {steps.map((step) => (
                  <li key={step.number}>
                    <Link href={step.href} onClick={followGuideLink}>
                      <span className={styles.stepNumber}>{step.number}</span>
                      <span className={styles.stepCopy}>
                        <small>{step.signal}</small>
                        <strong>{step.title}</strong>
                        <span>{step.body}</span>
                        <em>
                          {step.action} <span aria-hidden="true">→</span>
                        </em>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>

              <section className={styles.glossary} aria-labelledby="guide-glossary-title">
                <div id="guide-glossary-title">QUICK GLOSSARY</div>
                <dl>
                  <div><dt>Scenario</dt><dd>one test setup</dd></div>
                  <div><dt>Suite</dt><dd>a group of scenarios</dd></div>
                  <div><dt>Wall</dt><dd>the live result grid</dd></div>
                  <div><dt>Replay</dt><dd>evidence for one scenario</dd></div>
                  <div><dt>Rulebook</dt><dd>your approved testable policies</dd></div>
                </dl>
              </section>
            </div>
          </div>
        </div>
      )}
    </GuideContext.Provider>
  );
}

export function useAppGuide() {
  const context = useContext(GuideContext);
  if (!context) throw new Error("useAppGuide must be used inside AppGuideProvider");
  return context;
}
