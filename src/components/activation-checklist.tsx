"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eyebrow } from "./ui";
import { useLiveAgents } from "@/lib/live";
import type { LiveRunListItem } from "@/lib/live-types";

/**
 * First-run activation checklist — the five steps from empty workspace
 * to a real evaluation, each checked off by actual state, never by
 * clicking. Disappears once everything is done.
 */

interface Step {
  label: string;
  detail: string;
  href: string;
  done: boolean;
}

export function ActivationChecklist({ runs }: { runs: LiveRunListItem[] }) {
  const { agents } = useLiveAgents();
  const [rulesCount, setRulesCount] = useState<number>(0);
  const [suiteReady, setSuiteReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/setup")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.rules) setRulesCount(d.rules.length);
      })
      .catch(() => {});
    fetch("/api/generate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.suite?.status === "ready") setSuiteReady(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const ownAgent = agents.some((a) => a.kind !== "reference");
  const anyRun = runs.length > 0;
  const realRun = runs.some(
    (r) => r.agentKind === "http" || r.agentKind === "openai" || r.provider === "anthropic",
  );

  const steps: Step[] = [
    {
      label: "Run a sandbox test",
      detail: "free, offline, zero setup",
      href: "/runs",
      done: anyRun,
    },
    {
      label: "Connect your own agent",
      detail: "HTTP or OpenAI-compatible endpoint",
      href: "/agents/connect",
      done: ownAgent,
    },
    {
      label: "Teach Preflight your policy",
      detail: "docs, prompt, real conversations, or 7 questions",
      href: "/setup",
      done: rulesCount > 0,
    },
    {
      label: "Generate your Rulebook suite",
      detail: "scenarios written for your rules",
      href: "/setup",
      done: suiteReady,
    },
    {
      label: "Run your agent for real",
      detail: "the score that means something",
      href: "/runs",
      done: realRun,
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <section className="mt-10 rounded-xl border border-edge bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Getting to a real evaluation</Eyebrow>
        <span className="font-mono text-[11px] tabular-nums text-mut">
          {steps.length - remaining}/{steps.length}
        </span>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className={`focus-ring block h-full rounded-lg border p-3 transition-colors ${
                s.done
                  ? "border-accent/30 bg-accent/5"
                  : "border-edge hover:border-mut"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                    s.done ? "border-accent/60 text-accent" : "border-edge text-mut"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={`text-[13px] font-medium ${s.done ? "text-sub line-through" : "text-ink"}`}>
                  {s.label}
                </span>
              </span>
              <span className="mt-1 block pl-6 text-[11px] leading-snug text-mut">{s.detail}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
