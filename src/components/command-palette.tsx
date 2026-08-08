"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { demoAgents } from "@/lib/fixtures/agents";
import { pastRuns } from "@/lib/fixtures/runs";
import { getScenarioById, scenarios } from "@/lib/fixtures/scenarios";
import { useMode } from "@/lib/mode";
import styles from "./command-palette.module.css";

/**
 * ⌘K — jump to anything with a URL: pages, agents, runs, scenarios.
 * Demo entities index the fixtures; live mode keeps page navigation.
 */

export const PALETTE_EVENT = "preflight:palette";

/** Open the palette from anywhere (the nav rail's search button). */
export function openPalette() {
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

interface Entry {
  type: "Pages" | "Agents" | "Runs" | "Scenarios";
  label: string;
  detail?: string;
  href: string;
  /** Extra text the query matches against. */
  keywords?: string;
}

const PAGES: Entry[] = [
  { type: "Pages", label: "Dashboard", href: "/dashboard" },
  { type: "Pages", label: "Setup", href: "/setup" },
  { type: "Pages", label: "Agents", href: "/agents" },
  { type: "Pages", label: "Connect an agent", href: "/agents/connect" },
  { type: "Pages", label: "Scenarios", href: "/scenarios" },
  { type: "Pages", label: "Run wall", href: "/runs", keywords: "runs mission control" },
  { type: "Pages", label: "Run history", href: "/runs/history", keywords: "past runs" },
  { type: "Pages", label: "Failures", href: "/failures", keywords: "critical fails misses" },
  { type: "Pages", label: "Reports", href: "/reports", keywords: "readiness report" },
  { type: "Pages", label: "Benchmark", href: "/benchmark", keywords: "compare versions diff" },
  { type: "Pages", label: "Pricing", href: "/pricing", keywords: "plans billing" },
];

const GROUP_CAPS: Record<Entry["type"], number> = {
  Pages: 5,
  Agents: 4,
  Runs: 5,
  Scenarios: 6,
};

export function CommandPalette() {
  const router = useRouter();
  const { mode } = useMode();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  const index = useMemo<Entry[]>(() => {
    if (mode === "live") return PAGES;
    return [
      ...PAGES,
      ...demoAgents.map<Entry>((a) => ({
        type: "Agents",
        label: `${a.name} ${a.version}`,
        detail: `${a.scoreHistory[a.scoreHistory.length - 1]}% · ${a.lastRun.agoLabel}`,
        href: `/agents/${a.id}`,
        keywords: a.id,
      })),
      ...pastRuns.map<Entry>((r) => ({
        type: "Runs",
        label: r.id,
        detail: `${r.agentName} ${r.agentVersion} · ${r.score}% · ${r.label}`,
        href: `/runs/${r.id}`,
      })),
      ...scenarios.map<Entry>((s) => ({
        type: "Scenarios",
        label: s.id,
        detail: s.name,
        href: `/scenarios/${s.id}`,
        keywords: `${s.name} ${s.category}`,
      })),
    ];
  }, [mode]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let matched: Entry[];
    if (!q) {
      matched = index.filter((e) => e.type === "Pages" || e.type === "Agents");
    } else {
      const scored = index
        .map((e) => {
          const label = e.label.toLowerCase();
          const hay = `${label} ${e.detail?.toLowerCase() ?? ""} ${e.keywords?.toLowerCase() ?? ""}`;
          const score = label.startsWith(q) ? 0 : label.includes(q) ? 1 : hay.includes(q) ? 2 : -1;
          return { e, score };
        })
        .filter((x) => x.score >= 0)
        .sort((a, b) => a.score - b.score);
      matched = scored.map((x) => x.e);
      // An extension-scenario id typed exactly resolves even past the base 200.
      if (matched.length === 0 && /^scn-\d{4}$/.test(q)) {
        const s = getScenarioById(q.toUpperCase());
        if (s) {
          matched = [
            {
              type: "Scenarios",
              label: s.id,
              detail: s.name,
              href: `/scenarios/${s.id}`,
            },
          ];
        }
      }
    }
    // Cap per group, keep group order stable.
    const counts: Record<string, number> = {};
    const capped = matched.filter((e) => {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
      return counts[e.type] <= GROUP_CAPS[e.type];
    });
    return capped.slice(0, 18);
  }, [index, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
    // Hand focus back to wherever ⌘K was pressed.
    openerRef.current?.focus?.();
  }, []);

  const openNow = useCallback(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (document.body.dataset.preflightGuide === "open") return;
        if (open) close();
        else openNow();
      } else if (e.key === "Escape" && open) {
        close();
      }
    };
    const onOpenEvent = () => {
      if (document.body.dataset.preflightGuide !== "open") openNow();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onOpenEvent);
    };
  }, [open, close, openNow]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the active option visible while arrowing through a long list.
  useEffect(() => {
    if (open) document.getElementById(`palette-opt-${cursor}`)?.scrollIntoView({ block: "nearest" });
  }, [open, cursor]);

  if (!open) return null;

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <div ref={dialogRef} className={`${styles.dialog} fixed inset-0 z-50`} role="dialog" aria-modal aria-label="Command palette">
      <div className={`${styles.backdrop} animate-fade-in absolute inset-0`} onClick={close} />
      <div className={`${styles.panel} animate-fade-up absolute left-1/2 top-24 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border`}>
        <div className={styles.meta} aria-hidden>
          <span className={styles.metaLabel}>PREFLIGHT / COMMAND INDEX</span>
          <kbd>ESC</kbd>
        </div>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="palette-listbox"
          aria-activedescendant={results[cursor] ? `palette-opt-${cursor}` : undefined}
          aria-label="Jump to a page, agent, run, or scenario"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter" && results[cursor]) {
              e.preventDefault();
              go(results[cursor].href);
            }
          }}
          placeholder="Jump to a page, agent, run, or scenario…"
          className={`${styles.input} w-full bg-transparent px-5 py-4 text-sm text-ink placeholder:text-mut outline-none`}
        />
        <div id="palette-listbox" role="listbox" aria-label="Results" className={`${styles.list} max-h-80 overflow-y-auto py-2`}>
          {results.length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-mut">No matches.</p>
          )}
          {results.map((e, i) => {
            const showHeading = i === 0 || results[i - 1].type !== e.type;
            return (
              <div key={`${e.type}:${e.href}`}>
                {showHeading && (
                  <div aria-hidden className={`${styles.heading} px-5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider`}>
                    {e.type}
                  </div>
                )}
                <button
                  id={`palette-opt-${i}`}
                  role="option"
                  aria-selected={i === cursor}
                  tabIndex={-1}
                  onClick={() => go(e.href)}
                  onMouseEnter={() => setCursor(i)}
                  className={`${styles.option} flex w-full cursor-pointer items-baseline justify-between gap-3 px-5 py-2 text-left text-[13px] ${
                    i === cursor ? `${styles.optionSelected} text-ink` : "text-sub"
                  }`}
                >
                  <span className="min-w-0 truncate">
                    {e.label}
                    {e.detail && <span className="ml-2 text-[12px] text-mut">{e.detail}</span>}
                  </span>
                  {i === cursor && (
                    <span aria-hidden className={`${styles.enter} shrink-0 font-mono text-[11px] text-accent`}>
                      ↵
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className={`${styles.footer} px-5 py-2.5 font-mono text-[10px] tracking-wider text-mut`}>
          ↑↓ NAVIGATE · ↵ OPEN · ESC CLOSE
        </div>
      </div>
    </div>
  );
}
