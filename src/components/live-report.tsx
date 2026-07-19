"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReadinessCard } from "./readiness-card";
import { RegressionPanel } from "./regression-panel";
import { RootCauses } from "./root-causes";
import { UpgradeNudge } from "./upgrade-nudge";
import { Button, ButtonLink, EmptyState, Eyebrow, LoadError, Skeleton } from "./ui";
import { GauntletMark, MockBadge, planKindLabel } from "./live-mission-control";
import { fetchPlan, fetchRun, fetchRuns } from "@/lib/live-api";
import { generateReportPdf } from "@/lib/report-pdf";
import {
  scoreOf,
  type LivePlan,
  type LiveRunListItem,
  type LiveRunSummary,
} from "@/lib/live-types";
import { getScenarioById } from "@/lib/fixtures/scenarios";
import { suiteLabel, tierById } from "@/lib/suite-tiers";

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** The live readiness report — computed from a real run's results. */
export function LiveReport() {
  // undefined = loading · "failed" = fetch failed · null = nothing to report.
  const [run, setRun] = useState<LiveRunSummary | null | undefined | "failed">(undefined);
  const [allRuns, setAllRuns] = useState<LiveRunListItem[]>([]);
  // Set when ?plan= is present — the report renders the whole flight
  // plan instead of a single run. Initialized from the URL so the
  // effect never has to set a synchronous "loading" state.
  const [planView, setPlanView] = useState<
    undefined | "loading" | "failed" | { plan: LivePlan; tierRun: LiveRunSummary | null }
  >(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("plan")
      ? "loading"
      : undefined,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const planParam = q.get("plan");
    if (planParam) {
      (async () => {
        const p = await fetchPlan(planParam);
        if (!p) {
          setPlanView("failed");
          return;
        }
        // The depth step's full results feed the hard-slice score.
        const tierStep = p.runs.find((r) => tierById(r.suite) && r.status === "complete");
        const tierRun = tierStep ? await fetchRun(tierStep.id) : null;
        setPlanView({ plan: p, tierRun });
      })();
      return;
    }
    const param = q.get("run");
    (async (): Promise<LiveRunSummary | null | "failed"> => {
      const list = await fetchRuns();
      if (!list) return "failed";
      setAllRuns(list);
      const targetId = param ?? list.find((r) => r.status === "complete")?.id;
      return targetId ? await fetchRun(targetId) : null;
    })().then(setRun);
  }, [attempt]);

  const report = useMemo(() => {
    if (!run || run === "failed") return null;
    const results = run.results;
    const byCategory = new Map<string, { pass: number; fail: number; partial: number; total: number }>();
    const catOf = (r: (typeof results)[number]) =>
      r.category ?? getScenarioById(r.scenarioId)?.category ?? "Other";
    for (const r of results) {
      if (r.outcome === "error") continue;
      const cat = catOf(r);
      const c = byCategory.get(cat) ?? { pass: 0, fail: 0, partial: 0, total: 0 };
      c.total += 1;
      if (r.outcome === "pass") c.pass += 1;
      else if (r.outcome === "fail") c.fail += 1;
      else c.partial += 1;
      byCategory.set(cat, c);
    }
    const cats = [...byCategory.entries()];
    const strengths = cats
      .filter(([, c]) => c.fail === 0 && c.partial === 0)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name]) => name);
    const weaknesses = cats
      .filter(([, c]) => c.fail > 0)
      .sort((a, b) => b[1].fail / b[1].total - a[1].fail / a[1].total)
      .map(([name]) => name);
    const risks = results
      .filter((r) => r.outcome === "fail")
      .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
      .slice(0, 5);
    const errors = results.filter((r) => r.outcome === "error");
    const tokens = results.reduce((a, r) => a + r.tokens, 0);
    const cost = results.reduce((a, r) => a + r.costUsd, 0);
    return { score: scoreOf(results), strengths, weaknesses, risks, errors, tokens, cost };
  }, [run]);

  if (planView === "loading") {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-8 py-16">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (planView === "failed") {
    return (
      <div className="mx-auto max-w-3xl px-8 py-24">
        <LoadError
          what="the sign-off report"
          onRetry={() => {
            setPlanView("loading");
            setAttempt((a) => a + 1);
          }}
        />
      </div>
    );
  }
  if (planView) {
    return <PlanReport plan={planView.plan} tierRun={planView.tierRun} />;
  }

  if (run === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-8 py-16">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (run === "failed") {
    return (
      <div className="mx-auto max-w-3xl px-8 py-24">
        <LoadError what="the live report" onRetry={() => setAttempt((a) => a + 1)} />
      </div>
    );
  }
  if (!run || !report) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-24">
        <EmptyState
          icon={
            <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.25" className="size-8">
              <path d="M8 3h12l6 6v19a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z" />
              <path d="M12 17h8M12 22h5" strokeLinecap="round" />
            </svg>
          }
          title="No completed live runs yet."
          body="Reports read from real transcripts. Run the agent against the store and the readiness report writes itself."
          action={<ButtonLink href="/runs">Start a run</ButtonLink>}
        />
      </div>
    );
  }

  const counts = {
    pass: run.results.filter((r) => r.outcome === "pass").length,
    fail: run.results.filter((r) => r.outcome === "fail").length,
    partial: run.results.filter((r) => r.outcome === "partial").length,
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Eyebrow>Readiness report · {run.id}</Eyebrow>
            {run.provider === "mock" && <MockBadge />}
          </div>
          <h1 className="font-display mt-3 text-4xl tracking-tight text-ink">{run.agentName}</h1>
          <p className="mt-2 text-sm text-sub">
            {suiteLabel(run.suite, run.scenarioIds.length)} ·{" "}
            {new Date(run.startedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <div className="no-print flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadReportPdf(run, report, counts)}
          >
            Download PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print / share
          </Button>
        </div>
      </div>

      <div className="mt-10">
        <ReadinessCard
          score={report.score}
          strengths={report.strengths}
          weaknesses={report.weaknesses}
          wallHref={`/runs/${run.id}`}
          meta={`${run.results.length} scenarios · ${counts.pass} passed · ${counts.fail} failed · ${counts.partial} partial${report.errors.length ? ` · ${report.errors.length} run error` : ""} · ${report.tokens.toLocaleString()} tok · $${report.cost.toFixed(2)}`}
        />
      </div>

      <SharePanel runId={run.id} score={report.score} />

      <CoveragePanel run={run} allRuns={allRuns} />

      <UpgradeNudge simsThisRun={run.results.length} />

      <RegressionPanel runId={run.id} />

      <RootCauses runId={run.id} />

      {report.risks.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl tracking-tight text-ink">
            The {report.risks.length} risks that matter
          </h2>
          <ol className="mt-6 space-y-6">
            {report.risks.map((risk, i) => {
              const name = risk.name ?? getScenarioById(risk.scenarioId)?.name ?? risk.scenarioId;
              return (
                <li key={risk.scenarioId} className="flex gap-5">
                  <span className="numeral mt-0.5 text-2xl text-mut">{i + 1}</span>
                  <div>
                    <h3 className="text-[15px] font-medium text-ink">
                      {name}
                      <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-sub">
                        {risk.severity}
                      </span>
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-sub">{risk.failureReason}</p>
                    <Link
                      href={`/replay/${risk.scenarioId}?run=${run.id}`}
                      className="focus-ring no-print mt-2 inline-block rounded text-[13px] text-accent hover:underline"
                    >
                      Watch the replay →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {report.errors.length > 0 && (
        <section className="mt-12 rounded-lg border border-warn/40 bg-warn/8 p-5">
          <Eyebrow>Run errors · excluded from the score</Eyebrow>
          <ul className="mt-3 space-y-1.5 text-[13px] text-warn">
            {report.errors.map((e) => (
              <li key={e.scenarioId}>
                <span className="font-mono">{e.scenarioId}</span> — {e.failureReason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-20 border-t border-edge pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-[12px] text-mut">
          <span>
            {run.agentName} · {run.agentKind} · provider {run.provider}
          </span>
          <span>
            score <span className="text-ink">{report.score}%</span> ·{" "}
            {new Date(run.startedAt).toISOString().slice(0, 10)} · generated by Preflight
          </span>
        </div>
      </section>
    </div>
  );
}

/**
 * What this score covers — and what it doesn't. A score can only vouch
 * for what was tested; this panel is the report saying so out loud.
 * Each dimension shows the agent's most recent run of that kind; the
 * policy row warns until a Rulebook suite has actually been run.
 */
function CoveragePanel({ run, allRuns }: { run: LiveRunSummary; allRuns: LiveRunListItem[] }) {
  const agentRuns = allRuns.filter(
    (r) => r.agentName === run.agentName && r.status === "complete",
  );
  const latest = (match: (suiteId: string) => boolean) =>
    agentRuns.find((r) => match(r.suite)); // list is newest-first

  const dimensions = [
    {
      label: "General support skills",
      detail: "the built-in scenario library",
      hit: latest((s) => !!tierById(s) || s === "full"),
    },
    {
      label: "Hard-mode pressure",
      detail: "difficulty 4–5 adversaries (The Gauntlet)",
      hit: latest((s) => s === "gauntlet"),
    },
    {
      label: "Prompt-injection security",
      detail: "attacks hidden in store data",
      hit: latest((s) => s === "security"),
    },
    {
      label: "Your own policies",
      detail: "Rulebook suite written from your rules",
      hit: latest((s) => s.startsWith("custom:")),
    },
  ];
  const policyTested = !!dimensions[3].hit;

  return (
    <section className="mt-6 rounded-xl border border-edge bg-surface p-6">
      <Eyebrow>What this score covers</Eyebrow>
      <ul className="mt-4 space-y-3">
        {dimensions.map((d) => (
          <li key={d.label} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0">
              <span className={d.hit ? "text-ink" : "text-sub"}>{d.label}</span>
              <span className="ml-2 hidden text-[12px] text-mut sm:inline">{d.detail}</span>
            </span>
            {d.hit ? (
              <Link
                href={`/runs/${d.hit.id}`}
                className="focus-ring shrink-0 rounded font-mono text-[12px] tabular-nums text-accent hover:underline"
              >
                ✓ {d.hit.score}% · {d.hit.id}
              </Link>
            ) : (
              <span className="shrink-0 font-mono text-[12px] text-mut">— not tested</span>
            )}
          </li>
        ))}
      </ul>
      {!policyTested && (
        <p className="mt-5 rounded-lg border border-warn/40 bg-warn/8 p-3.5 text-[13px] leading-relaxed text-warn">
          This score says nothing about your own policies — Preflight hasn&apos;t been
          taught them, so rules like &ldquo;refunds over £75 need manager approval&rdquo; were
          never tested.{" "}
          <Link href="/setup" className="focus-ring rounded font-medium underline">
            Teach Preflight your policy →
          </Link>
        </p>
      )}
    </section>
  );
}

/** Build and save the PDF artefact for a live run's report. */
function downloadReportPdf(
  run: LiveRunSummary,
  report: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    risks: LiveRunSummary["results"];
    tokens: number;
    cost: number;
  },
  counts: { pass: number; fail: number; partial: number },
) {
  void generateReportPdf({
    agentName: run.agentName,
    runId: run.id,
    suiteLine: suiteLabel(run.suite, run.scenarioIds.length),
    dateLine: new Date(run.startedAt).toLocaleDateString("en-US", { dateStyle: "long" }),
    score: report.score,
    metaLine: `${run.results.length} scenarios · ${counts.pass} passed · ${counts.fail} failed · ${counts.partial} partial · ${report.tokens.toLocaleString()} tokens · $${report.cost.toFixed(2)}`,
    strengths: report.strengths,
    weaknesses: report.weaknesses,
    risks: report.risks.map((r) => ({
      title: r.name ?? getScenarioById(r.scenarioId)?.name ?? r.scenarioId,
      severity: r.severity,
      body: r.failureReason ?? "",
    })),
  });
}

/**
 * Share this result — mint the public link + badge. The token is
 * unguessable and read-only: score, category shape, and the miniature
 * wall go public; transcripts never do.
 */
function SharePanel({ runId, score }: { runId: string; score: number }) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const mint = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/live/runs/${runId}/share`, { method: "POST" });
      const json = await res.json();
      if (res.ok) setToken(json.token);
      else setError(json.error ?? "Couldn't create the share link.");
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  };

  const copy = (label: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    });
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = token ? `${origin}/share/${token}` : "";
  const badgeUrl = token ? `${origin}/api/badge/${token}` : "";
  const markdown = token ? `[![Preflight](${badgeUrl})](${shareUrl})` : "";

  return (
    <section className="no-print mt-6 rounded-xl border border-edge bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow>Share this result</Eyebrow>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-sub">
            A public, read-only page plus an embeddable score badge — proof this agent
            went through Preflight. Transcripts stay private.
          </p>
        </div>
        {!token && (
          <Button variant="secondary" size="sm" onClick={mint} disabled={busy}>
            {busy ? "Creating…" : "Create public link"}
          </Button>
        )}
      </div>
      {error && <p className="mt-3 text-[13px] text-warn">{error}</p>}
      {token && (
        <div className="mt-5 space-y-3 border-t border-edge pt-5">
          <div className="flex items-center gap-3">
            {/* The badge itself, live from the endpoint. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt={`Preflight score badge: ${score}`} className="h-5" />
            <span className="font-mono text-[11px] text-mut">← this badge is live at the URL below</span>
          </div>
          <ShareRow label="Public page" value={shareUrl} copied={copied} onCopy={copy} />
          <ShareRow label="Badge image" value={badgeUrl} copied={copied} onCopy={copy} />
          <ShareRow label="README markdown" value={markdown} copied={copied} onCopy={copy} />
        </div>
      )}
    </section>
  );
}

function ShareRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 font-mono text-[10px] uppercase tracking-wider text-mut">
        {label}
      </span>
      <code className="min-w-0 flex-1 truncate rounded-md border border-edge bg-raised px-2.5 py-1.5 font-mono text-[11px] text-sub">
        {value}
      </code>
      <Button variant="ghost" size="sm" onClick={() => onCopy(label, value)}>
        {copied === label ? "Copied ✓" : "Copy"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The sign-off report — one flight plan, one verdict. A checklist,   */
/* deliberately not a single blended number: averaging a 99% coverage */
/* score with a failed security run is how agents ship broken.        */
/* ------------------------------------------------------------------ */

function scoreTone(score: number): string {
  return score >= 90 ? "text-accent" : score >= 75 ? "text-warn" : "text-fail";
}

function planStepLabel(suiteId: string, total: number): { name: string; detail: string } {
  if (suiteId === "security")
    return { name: "Security", detail: `prompt-injection suite · ${total} attacks` };
  if (suiteId === "gauntlet")
    return { name: "Hard mode", detail: `The Gauntlet · ${total} scenarios` };
  if (suiteId.startsWith("custom:"))
    return { name: "Your policies", detail: `Rulebook suite · ${total} scenarios` };
  const tier = tierById(suiteId);
  return {
    name: "Coverage",
    detail: `${tier?.name ?? suiteId} · ${total.toLocaleString()} scenarios`,
  };
}

function PlanReport({ plan, tierRun }: { plan: LivePlan; tierRun: LiveRunSummary | null }) {
  const steps = plan.runs;
  const hasPolicy = steps.some((r) => r.suite.startsWith("custom:"));
  const completed = steps.filter((r) => r.status === "complete");
  const allComplete = completed.length === steps.length;
  const minScore = completed.length ? Math.min(...completed.map((r) => r.score)) : 0;
  const ready = plan.done && allComplete && minScore >= 90 && hasPolicy;

  // The hard slice: difficulty 4–5 scenarios inside the coverage step —
  // the Gauntlet's content, scored without a separate run.
  let hardSlice: { pass: number; total: number } | null = null;
  if (tierRun) {
    const hard = tierRun.results.filter(
      (r) => (getScenarioById(r.scenarioId)?.difficulty ?? 0) >= 4 && r.outcome !== "error",
    );
    if (hard.length > 0) {
      hardSlice = {
        pass: hard.filter((r) => r.outcome === "pass").length,
        total: hard.length,
      };
    }
  }
  const hardPct = hardSlice ? Math.round((hardSlice.pass / hardSlice.total) * 100) : null;

  const verdict = !plan.done
    ? "In progress"
    : ready
      ? "Ready to ship"
      : "Not ready";
  const reason = !plan.done
    ? `${completed.length}/${steps.length} steps finished — the wall is still filling in.`
    : ready
      ? "Every layer is green, including your own policies."
      : !allComplete
        ? "A step ended in a run error — rerun it before signing off."
        : minScore < 90
          ? "At least one layer scored below 90 — the rows below show where."
          : "Your own policies were not part of this job.";

  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow>
            {planKindLabel(plan.planKind)} · {plan.planId}
          </Eyebrow>
          <h1 className="font-display mt-3 text-4xl tracking-tight text-ink">{plan.agentName}</h1>
          <p className="mt-2 text-sm text-sub">
            {steps.length} suites, run in sequence against a clean store each.
          </p>
        </div>
        <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
          Print / share
        </Button>
      </div>

      {/* The verdict — a checklist outcome, not an average. */}
      <div className="mt-10 rounded-xl border border-edge bg-surface p-8 text-center shadow-card">
        <div
          className={`font-display text-4xl tracking-tight ${
            ready ? "text-accent" : plan.done ? "text-warn" : "text-sub"
          }`}
        >
          {verdict}
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-sub">{reason}</p>
      </div>

      <div className="mt-6 space-y-3">
        {steps.map((r) => {
          const label = planStepLabel(r.suite, r.total);
          const pending = r.status === "queued" || r.status === "running";
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-edge bg-surface px-5 py-4"
            >
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-ink">{label.name}</div>
                <div className="mt-0.5 text-[12px] text-mut">{label.detail}</div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                {pending ? (
                  <span className="font-mono text-[12px] text-mut">
                    {r.status === "running" ? "running…" : "queued"}
                  </span>
                ) : r.status === "error" ? (
                  <span className="font-mono text-[12px] text-warn">run error</span>
                ) : (
                  <span className={`numeral text-2xl ${scoreTone(r.score)}`}>
                    {r.score}
                    <span className="text-sm text-mut">%</span>
                  </span>
                )}
                {r.status === "complete" && (
                  <Link
                    href={`/reports?run=${r.id}`}
                    className="focus-ring rounded font-mono text-[11px] text-accent hover:underline"
                  >
                    full report →
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {hardPct !== null && hardSlice && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-edge px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <GauntletMark />
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-ink">Hard slice</div>
                <div className="mt-0.5 text-[12px] text-mut">
                  the {hardSlice.total} difficulty-4/5 scenarios inside the coverage run
                </div>
              </div>
            </div>
            <span className={`numeral shrink-0 text-2xl ${scoreTone(hardPct)}`}>
              {hardPct}
              <span className="text-sm text-mut">%</span>
            </span>
          </div>
        )}
      </div>

      {!hasPolicy && (
        <p className="mt-6 rounded-lg border border-warn/40 bg-warn/8 p-3.5 text-[13px] leading-relaxed text-warn">
          This job never tested your own policies — no Rulebook suite exists yet, so a
          green verdict here still says nothing about rules like &ldquo;refunds over £75 need
          manager approval&rdquo;.{" "}
          <Link href="/setup" className="focus-ring rounded font-medium underline">
            Teach Preflight your policy →
          </Link>
        </p>
      )}

      <section className="mt-20 border-t border-edge pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-[12px] text-mut">
          <span>
            {plan.agentName} · {planKindLabel(plan.planKind).toLowerCase()}
          </span>
          <span>generated by Preflight</span>
        </div>
      </section>
    </div>
  );
}
