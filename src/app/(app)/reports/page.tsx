"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const subscribeNever = () => () => {};
import { ReadinessCard } from "@/components/readiness-card";
import { GauntletMark } from "@/components/run-badges";
import { Button, Eyebrow } from "@/components/ui";
import { LiveReport } from "@/components/live-report";
import { demoReport } from "@/lib/fixtures/report";
import { readiness, runStats } from "@/lib/fixtures/run";
import { demoOutcomes, failingReplayId, scenarios } from "@/lib/fixtures/scenarios";
import { generateReportPdf } from "@/lib/report-pdf";
import { useMode } from "@/lib/mode";

function downloadDemoReportPdf() {
  const r = demoReport;
  void generateReportPdf({
    agentName: `${r.agent} ${r.agentVersion}`,
    runId: r.runId,
    suiteLine: r.suite,
    dateLine: r.date,
    score: readiness.score,
    metaLine: `${runStats.total} scenarios · ${runStats.pass} passed · ${runStats.fail} failed · ${runStats.partial} partial`,
    strengths: readiness.strengths,
    weaknesses: readiness.weaknesses,
    risks: r.risks.map((risk) => ({ title: risk.title, body: risk.body })),
  });
}

const weaknessHrefs = Object.fromEntries(
  readiness.weaknesses.map((w) => {
    const id = failingReplayId(w);
    return [w, id && `/replay/${id}`];
  }),
);

/**
 * The readiness report — a document, not a dashboard. This is the
 * artefact a champion forwards to their boss.
 */
export default function ReportsPage() {
  const { mode } = useMode();
  if (mode === "live") return <LiveReport />;

  const r = demoReport;

  return (
    <div className="mx-auto max-w-3xl px-8 py-16">
      {/* Document head */}
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow>Readiness report · {r.runId}</Eyebrow>
          <h1 className="font-display mt-3 text-4xl tracking-tight text-ink">
            {r.agent} {r.agentVersion}
          </h1>
          <p className="mt-2 text-sm text-sub">
            {r.suite} · {r.date}
          </p>
        </div>
        <div className="no-print flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadDemoReportPdf()}>
            Download PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print / share
          </Button>
        </div>
      </div>

      <div className="mt-10">
        <ReadinessCard
          score={readiness.score}
          strengths={readiness.strengths}
          weaknesses={readiness.weaknesses}
          wallHref={`/runs/${r.runId}`}
          meta={`Run ${r.runId} · ${runStats.total} scenarios · ${runStats.pass} passed · ${runStats.fail} failed · ${runStats.partial} partial`}
          hrefs={weaknessHrefs}
        />
      </div>

      <DemoCoveragePanel />

      <DemoSharePanel />

      {/* Failure taxonomy */}
      <section className="mt-16">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Where it breaks
        </h2>
        <div className="mt-6 space-y-8">
          {r.taxonomy.map((t) => (
            <div key={t.finding} className="border-l-2 border-edge pl-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-[15px] font-medium text-ink">{t.finding}</h3>
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-mut">
                  {t.failed} / {t.total}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-sub">{t.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top risks */}
      <section className="mt-16">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          The five risks that matter
        </h2>
        <ol className="mt-6 space-y-6">
          {r.risks.map((risk, i) => (
            <li key={risk.title} className="flex gap-5">
              <span className="numeral mt-0.5 text-2xl text-mut">{i + 1}</span>
              <div>
                <h3 className="text-[15px] font-medium text-ink">{risk.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-sub">
                  {risk.body}
                </p>
                <Link
                  href={`/replay/${risk.replayId}`}
                  className="focus-ring no-print mt-2 inline-block rounded text-[13px] text-accent hover:underline"
                >
                  Watch the replay →
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <DemoRedteamPreview patternCount={r.taxonomy.length} />

      {/* Sign-off */}
      <section className="mt-20 border-t border-edge pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4 font-mono text-[12px] text-mut">
          <span>
            {r.agent} {r.agentVersion} · suite {r.suiteVersion}
          </span>
          <span>
            score{" "}
            <span className="text-ink">
              {r.score}%
            </span>{" "}
            · {r.date} · generated by Preflight
          </span>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo showcases of the live-mode surfaces — fixture-backed, honest, */
/* so the pitch mode shows the whole product.                         */
/* ------------------------------------------------------------------ */

/** What this 97% covers — the trust story, demo edition. */
function DemoCoveragePanel() {
  const hard = scenarios.filter((s) => s.difficulty >= 4);
  const hardPass = hard.filter((s) => (demoOutcomes.get(s.id) ?? "pass") === "pass").length;
  return (
    <section className="mt-6 rounded-xl border border-edge bg-surface p-6">
      <Eyebrow>What this score covers</Eyebrow>
      <ul className="mt-4 space-y-3">
        <li className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-ink">
            General support skills
            <span className="ml-2 hidden text-[12px] text-mut sm:inline">the 200-scenario base suite</span>
          </span>
          <Link
            href={`/runs/${demoReport.runId}`}
            className="focus-ring shrink-0 rounded font-mono text-[12px] tabular-nums text-accent hover:underline"
          >
            ✓ 97% · {demoReport.runId}
          </Link>
        </li>
        <li className="flex items-baseline justify-between gap-4 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-ink">
            <GauntletMark />
            Hard slice
            <span className="hidden text-[12px] text-mut sm:inline">
              the {hard.length} difficulty-4/5 scenarios inside this run
            </span>
          </span>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-warn">
            {hardPass}/{hard.length} passed
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-sub">
            Prompt-injection security
            <span className="ml-2 hidden text-[12px] text-mut sm:inline">attacks hidden in store data</span>
          </span>
          <span className="shrink-0 font-mono text-[12px] text-mut">— not tested</span>
        </li>
        <li className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-sub">
            Your own policies
            <span className="ml-2 hidden text-[12px] text-mut sm:inline">Rulebook suite written from your rules</span>
          </span>
          <span className="shrink-0 font-mono text-[12px] text-mut">— not tested</span>
        </li>
      </ul>
      <p className="mt-5 rounded-lg border border-warn/40 bg-warn/8 p-3.5 text-[13px] leading-relaxed text-warn">
        Even 97% says nothing about rules Preflight was never taught — like &ldquo;refunds
        over £75 need manager approval&rdquo;.{" "}
        <Link href="/setup" className="focus-ring rounded font-medium underline">
          Teach Preflight your policy →
        </Link>
      </p>
    </section>
  );
}

/** The demo run's real public page + badge — sharing is live in demo. */
function DemoSharePanel() {
  const [copied, setCopied] = useState<string | null>(null);
  // Origin is only known in the browser; hydrate with the empty server
  // snapshot first so server and client render identically.
  const origin = useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
  const shareUrl = `${origin}/share/demo`;
  const badgeUrl = `${origin}/api/badge/demo`;
  const markdown = `[![Preflight](${badgeUrl})](${shareUrl})`;

  const copy = (label: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    });
  };

  return (
    <section className="no-print mt-6 rounded-xl border border-edge bg-surface p-6">
      <Eyebrow>Share this result</Eyebrow>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-sub">
        Every completed run can mint a public, read-only page and an embeddable score
        badge. This demo run&apos;s are live right now:
      </p>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt="Preflight score badge: 97" className="h-5" />
          <Link
            href="/share/demo"
            className="focus-ring rounded font-mono text-[11px] text-accent hover:underline"
          >
            open the public page →
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-32 shrink-0 font-mono text-[10px] uppercase tracking-wider text-mut">
            README markdown
          </span>
          <code className="min-w-0 flex-1 truncate rounded-md border border-edge bg-raised px-2.5 py-1.5 font-mono text-[11px] text-sub">
            {markdown}
          </code>
          <Button variant="ghost" size="sm" onClick={() => copy("md", markdown)}>
            {copied === "md" ? "Copied ✓" : "Copy"}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** The adaptive loop, previewed — live mode generates the real suite. */
function DemoRedteamPreview({ patternCount }: { patternCount: number }) {
  const [previewed, setPreviewed] = useState(false);
  return (
    <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-warn/30 bg-warn/5 px-6 py-5">
      <div className="flex min-w-0 items-center gap-4">
        <GauntletMark />
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-ink">Attack these weaknesses</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-sub">
            One click turns these {patternCount} failure patterns into a red-team suite —
            escalating variants of exactly what this agent got wrong.
          </p>
        </div>
      </div>
      {previewed ? (
        <span className="text-[13px] leading-relaxed text-accent">
          Preview: {patternCount} patterns → ~{patternCount * 6} adversarial scenarios.
          Switch to Live mode to generate a runnable suite.
        </span>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setPreviewed(true)}>
          Generate red-team suite
        </Button>
      )}
    </div>
  );
}
